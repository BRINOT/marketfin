import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import tracer from 'dd-trace';

@Injectable()
export class DatadogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const span = tracer.scope().active();

    if (span && request) {
      // Add custom tags to the span
      span.setTag('http.route', request.route?.path || request.url);
      span.setTag('tenant.id', request.tenantId || 'unknown');
      span.setTag('user.id', request.user?.id || 'anonymous');
      span.setTag('user.role', request.user?.role || 'none');
    }

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          if (span) {
            span.setTag('response.time_ms', Date.now() - now);
            span.setTag('response.success', true);
          }
        },
        error: (error) => {
          if (span) {
            span.setTag('response.time_ms', Date.now() - now);
            span.setTag('response.success', false);
            span.setTag('error.message', error.message);
            span.setTag('error.type', error.constructor.name);
          }
        },
      }),
    );
  }
}
