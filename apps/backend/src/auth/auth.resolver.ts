import { Resolver, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserType } from './types/user.type';
import { AuthenticatedUser } from './auth.service';

@Resolver(() => UserType)
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Query(() => UserType, { name: 'me' })
  @UseGuards(AuthGuard)
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<UserType> {
    const fullUser = await this.authService.getUserById(user.id);
    
    if (!fullUser) {
      throw new Error('User not found');
    }

    return {
      id: fullUser.id,
      email: fullUser.email,
      firstName: fullUser.firstName,
      lastName: fullUser.lastName,
      role: fullUser.role,
      tenantId: fullUser.tenantId,
      isActive: fullUser.isActive,
      lastLoginAt: fullUser.lastLoginAt,
      createdAt: fullUser.createdAt,
    };
  }
}
