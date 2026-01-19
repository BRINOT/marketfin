import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface InviteUserInput {
  email: string;
  role: UserRole;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async getUserByClerkId(clerkUserId: string) {
    return this.prisma.user.findUnique({
      where: { clerkUserId },
      include: { tenant: true },
    });
  }

  async inviteUser(tenantId: string, input: InviteUserInput, currentUserRole: UserRole) {
    // Only admins can invite users
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem convidar usuários');
    }

    // Check if user already exists in this tenant
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: input.email,
        tenantId,
      },
    });

    if (existingUser) {
      throw new ForbiddenException('Este usuário já faz parte da equipe');
    }

    // Create pending user (will be linked to Clerk when they sign up)
    return this.prisma.user.create({
      data: {
        email: input.email,
        role: input.role,
        tenantId,
        clerkUserId: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    });
  }

  async updateUserRole(
    userId: string,
    role: UserRole,
    tenantId: string,
    currentUserRole: UserRole,
  ) {
    // Only admins can update roles
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem alterar funções');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Prevent removing the last admin
    if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: UserRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException('Não é possível remover o último administrador');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async removeUser(
    userId: string,
    tenantId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // Only admins can remove users
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem remover usuários');
    }

    // Prevent self-removal
    if (userId === currentUserId) {
      throw new ForbiddenException('Você não pode remover a si mesmo');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Prevent removing the last admin
    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: UserRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException('Não é possível remover o último administrador');
      }
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return true;
  }

  async countUsers(tenantId: string) {
    return this.prisma.user.count({
      where: { tenantId },
    });
  }

  async createOrUpdateFromClerk(data: {
    clerkUserId: string;
    email: string;
    tenantId?: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { clerkUserId: data.clerkUserId },
    });

    if (existingUser) {
      return this.prisma.user.update({
        where: { clerkUserId: data.clerkUserId },
        data: { email: data.email },
      });
    }

    // Check if there's a pending invitation for this email
    const pendingUser = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        clerkUserId: { startsWith: 'pending_' },
      },
    });

    if (pendingUser) {
      return this.prisma.user.update({
        where: { id: pendingUser.id },
        data: { clerkUserId: data.clerkUserId },
      });
    }

    // Create new tenant and user
    const tenant = await this.prisma.tenant.create({
      data: {
        name: `Empresa de ${data.email.split('@')[0]}`,
      },
    });

    return this.prisma.user.create({
      data: {
        email: data.email,
        clerkUserId: data.clerkUserId,
        tenantId: tenant.id,
        role: UserRole.ADMIN,
      },
    });
  }
}
