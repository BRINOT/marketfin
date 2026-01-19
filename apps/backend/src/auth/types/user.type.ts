import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '@prisma/client';

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User roles for RBAC',
});

@ObjectType('User')
export class UserType {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  firstName?: string | null;

  @Field({ nullable: true })
  lastName?: string | null;

  @Field(() => UserRole)
  role: UserRole;

  @Field()
  tenantId: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  lastLoginAt?: Date | null;

  @Field()
  createdAt: Date;
}
