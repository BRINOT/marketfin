import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Get request context
        const ctx = GqlExecutionContext.create(context);
        const { req } = ctx.getContext();

        // Add context to Sentry
        Sentry.withScope((scope) => {
          // Add user context
          if (req?.user) {
            scope.setUser({
              id: req.user.id,
              email: req.user.email,
            });
          }

          // Add tenant context
          if (req?.tenantId) {
            scope.setTag('tenantId', req.tenantId);
          }

          // Add request context
          scope.setContext('request', {
            url: req?.url,
            method: req?.method,
            headers: {
              'user-agent': req?.headers?.['user-agent'],
              'content-type': req?.headers?.['content-type'],
            },
          });

          // Capture the exception
          Sentry.captureException(error);
        });

        return throwError(() => error);
      }),
    );
  }
}
