import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';

@Module({
  providers: [
    AuthService,
    AuthResolver,
    AuthGuard,
    RolesGuard,
    RateLimiterGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, AuthGuard, RolesGuard, RateLimiterGuard],
})
export class AuthModule {}
