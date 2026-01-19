import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private limiter: RateLimiterRedis;

  constructor(private redisService: RedisService) {
    this.limiter = new RateLimiterRedis({
      storeClient: this.redisService.getClient(),
      keyPrefix: 'marketfin_rl',
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
      blockDuration: 60, // Block for 60 seconds if exceeded
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    // Create rate limit key based on tenant and IP
    const tenantId = req.user?.tenantId || 'anonymous';
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${tenantId}:${ip}`;

    try {
      await this.limiter.consume(key);
      return true;
    } catch (rateLimiterRes) {
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000) || 60;
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
