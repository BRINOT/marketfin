import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Resolver('User')
@UseGuards(GqlAuthGuard, RolesGuard)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query('getUsers')
  @Roles(UserRole.ADMIN)
  async getUsers(@Context() ctx: any) {
    return this.userService.getUsers(ctx.req.tenantId);
  }

  @Mutation('inviteUser')
  @Roles(UserRole.ADMIN)
  async inviteUser(
    @Args('input') input: { email: string; role: UserRole },
    @Context() ctx: any,
  ) {
    return this.userService.inviteUser(ctx.req.tenantId, input, ctx.req.user.role);
  }

  @Mutation('updateUserRole')
  @Roles(UserRole.ADMIN)
  async updateUserRole(
    @Args('userId') userId: string,
    @Args('role') role: UserRole,
    @Context() ctx: any,
  ) {
    return this.userService.updateUserRole(
      userId,
      role,
      ctx.req.tenantId,
      ctx.req.user.role,
    );
  }

  @Mutation('removeUser')
  @Roles(UserRole.ADMIN)
  async removeUser(@Args('userId') userId: string, @Context() ctx: any) {
    return this.userService.removeUser(
      userId,
      ctx.req.tenantId,
      ctx.req.user.id,
      ctx.req.user.role,
    );
  }
}
