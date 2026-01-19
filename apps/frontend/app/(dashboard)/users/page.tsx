'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  UserPlus,
  Trash2,
  Edit,
  Shield,
  Users,
  Mail,
  MoreVertical,
} from 'lucide-react';

const GET_USERS = gql`
  query GetUsers {
    getUsers {
      id
      email
      role
      clerkUserId
      createdAt
    }
  }
`;

const INVITE_USER = gql`
  mutation InviteUser($input: InviteUserInput!) {
    inviteUser(input: $input) {
      id
      email
      role
    }
  }
`;

const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: ID!, $role: UserRole!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      role
    }
  }
`;

const REMOVE_USER = gql`
  mutation RemoveUser($userId: ID!) {
    removeUser(userId: $userId)
  }
`;

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  VIEWER: 'Visualizador',
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Acesso total ao sistema, incluindo configurações e gerenciamento de usuários',
  MANAGER: 'Pode gerenciar produtos, pedidos e visualizar relatórios',
  VIEWER: 'Apenas visualização de dados e relatórios',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(GET_USERS);

  const [inviteUser, { loading: inviting }] = useMutation(INVITE_USER, {
    onCompleted: () => {
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('VIEWER');
      refetch();
    },
  });

  const [updateUserRole] = useMutation(UPDATE_USER_ROLE, {
    onCompleted: () => {
      setEditingUser(null);
      refetch();
    },
  });

  const [removeUser] = useMutation(REMOVE_USER, {
    onCompleted: () => refetch(),
  });

  const handleInvite = () => {
    inviteUser({
      variables: {
        input: {
          email: inviteEmail,
          role: inviteRole,
        },
      },
    });
  };

  const handleUpdateRole = (userId: string, role: string) => {
    updateUserRole({
      variables: { userId, role },
    });
  };

  const handleRemoveUser = (userId: string, email: string) => {
    if (confirm(`Tem certeza que deseja remover ${email} da equipe?`)) {
      removeUser({ variables: { userId } });
    }
  };

  const filteredUsers = data?.getUsers?.filter((user: any) =>
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const usersByRole = {
    ADMIN: filteredUsers?.filter((u: any) => u.role === 'ADMIN')?.length || 0,
    MANAGER: filteredUsers?.filter((u: any) => u.role === 'MANAGER')?.length || 0,
    VIEWER: filteredUsers?.filter((u: any) => u.role === 'VIEWER')?.length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os membros da sua equipe e suas permissões
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : filteredUsers?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersByRole.ADMIN}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gerentes</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersByRole.MANAGER}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizadores</CardTitle>
            <Shield className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersByRole.VIEWER}</div>
          </CardContent>
        </Card>
      </div>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Níveis de Acesso</CardTitle>
          <CardDescription>Entenda as permissões de cada função</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(roleDescriptions).map(([role, description]) => (
              <div key={role} className="p-4 border rounded-lg">
                <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>
                <p className="text-sm text-muted-foreground mt-2">{description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredUsers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers?.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.email}</span>
                        <Badge className={roleColors[user.role]}>{roleLabels[user.role]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Adicionado em{' '}
                        {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingUser === user.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className="px-3 py-1 border rounded-md text-sm"
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="MANAGER">Gerente</option>
                          <option value="VIEWER">Visualizador</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(user.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUser(user.id, user.email)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Convidar Usuário</CardTitle>
              <CardDescription>
                Envie um convite para um novo membro da equipe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Função</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                >
                  <option value="VIEWER">Visualizador</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {roleDescriptions[inviteRole]}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowInviteModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                  {inviting ? 'Enviando...' : 'Enviar Convite'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
