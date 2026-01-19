import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new HttpException('Tenant not found', HttpStatus.UNAUTHORIZED);
    }

    const orderCheck = await this.subscriptionService.checkOrderLimit(tenantId);

    if (!orderCheck.allowed) {
      throw new HttpException(
        {
          message: 'Limite de pedidos excedido. Faça upgrade do seu plano.',
          code: 'ORDER_LIMIT_EXCEEDED',
          current: orderCheck.current,
          limit: orderCheck.limit,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}

@Injectable()
export class IntegrationLimitGuard implements CanActivate {
  constructor(private subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new HttpException('Tenant not found', HttpStatus.UNAUTHORIZED);
    }

    const integrationCheck = await this.subscriptionService.checkIntegrationLimit(tenantId);

    if (!integrationCheck.allowed) {
      throw new HttpException(
        {
          message: 'Limite de integrações excedido. Faça upgrade do seu plano.',
          code: 'INTEGRATION_LIMIT_EXCEEDED',
          current: integrationCheck.current,
          limit: integrationCheck.limit,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}

@Injectable()
export class UserLimitGuard implements CanActivate {
  constructor(private subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new HttpException('Tenant not found', HttpStatus.UNAUTHORIZED);
    }

    const userCheck = await this.subscriptionService.checkUserLimit(tenantId);

    if (!userCheck.allowed) {
      throw new HttpException(
        {
          message: 'Limite de usuários excedido. Faça upgrade do seu plano.',
          code: 'USER_LIMIT_EXCEEDED',
          current: userCheck.current,
          limit: userCheck.limit,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
