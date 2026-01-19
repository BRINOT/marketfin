import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User, UserRole } from '@prisma/client';

export interface ClerkUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  publicMetadata: {
    tenantId?: string;
    role?: UserRole;
  };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  tenantId: string;
  clerkUserId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Verify Clerk session token and return user
   */
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      // Verify the session token with Clerk
      const sessionClaims = await clerkClient.verifyToken(token);
      
      if (!sessionClaims || !sessionClaims.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { clerkUserId: sessionClaims.sub },
        include: { tenant: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User is deactivated');
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        clerkUserId: user.clerkUserId,
      };
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Sync user from Clerk webhook
   */
  async syncUserFromClerk(clerkUser: ClerkUser): Promise<User> {
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    
    if (!email) {
      throw new Error('User has no email address');
    }

    const tenantId = clerkUser.publicMetadata?.tenantId;
    const role = clerkUser.publicMetadata?.role || UserRole.VIEWER;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { clerkUserId: clerkUser.id },
    });

    if (existingUser) {
      // Update existing user
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          role,
        },
      });
    }

    // Create new user
    // If no tenantId, create a new tenant for this user
    let finalTenantId = tenantId;
    
    if (!finalTenantId) {
      const tenant = await this.prisma.tenant.create({
        data: {
          name: `${clerkUser.firstName || 'User'}'s Organization`,
          slug: `org-${clerkUser.id.slice(-8)}`,
        },
      });
      finalTenantId = tenant.id;

      // Update Clerk user metadata with tenantId
      await clerkClient.users.updateUser(clerkUser.id, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          tenantId: finalTenantId,
          role: UserRole.ADMIN, // First user is admin
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        role: tenantId ? role : UserRole.ADMIN,
        tenantId: finalTenantId,
        clerkUserId: clerkUser.id,
      },
    });
  }

  /**
   * Delete user (for Clerk webhook)
   */
  async deleteUser(clerkUserId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { clerkUserId },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });
  }

  /**
   * Get users by tenant
   */
  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    // Sync role to Clerk
    await clerkClient.users.updateUser(user.clerkUserId, {
      publicMetadata: { role },
    });

    return user;
  }

  /**
   * Check if user has permission
   */
  hasPermission(user: AuthenticatedUser, requiredRoles: UserRole[]): boolean {
    return requiredRoles.includes(user.role);
  }
}
