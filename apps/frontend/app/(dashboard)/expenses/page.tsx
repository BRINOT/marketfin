'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Edit,
  DollarSign,
  TrendingUp,
  Calendar,
  Tag,
} from 'lucide-react';

const GET_EXPENSES = gql`
  query GetExpenses($filters: ExpenseFilters!) {
    getExpenses(filters: $filters) {
      items {
        id
        type
        amount
        date
        description
        marketplace
      }
      total
      totalAmount
    }
    getExpenseStats {
      totalExpenses
      byType {
        type
        amount
        percentage
      }
      byMonth {
        month
        amount
      }
    }
  }
`;

const CREATE_EXPENSE = gql`
  mutation CreateExpense($input: CreateExpenseInput!) {
    createExpense(input: $input) {
      id
      type
      amount
      date
      description
    }
  }
`;

const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id)
  }
`;

const expenseTypeLabels: Record<string, string> = {
  ADS: 'Publicidade',
  FREIGHT: 'Frete',
  PRODUCT_COST: 'Custo de Produto',
  STORAGE: 'Armazenagem',
  OTHER: 'Outros',
};

const expenseTypeColors: Record<string, string> = {
  ADS: 'bg-purple-100 text-purple-800',
  FREIGHT: 'bg-blue-100 text-blue-800',
  PRODUCT_COST: 'bg-green-100 text-green-800',
  STORAGE: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function ExpensesPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    type: 'OTHER',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    marketplace: '',
  });

  const { data, loading, refetch } = useQuery(GET_EXPENSES, {
    variables: {
      filters: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        type: typeFilter || undefined,
        search: search || undefined,
      },
    },
  });

  const [createExpense, { loading: creating }] = useMutation(CREATE_EXPENSE, {
    onCompleted: () => {
      setShowCreateModal(false);
      setNewExpense({
        type: 'OTHER',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        marketplace: '',
      });
      refetch();
    },
  });

  const [deleteExpense] = useMutation(DELETE_EXPENSE, {
    onCompleted: () => refetch(),
  });

  const handleCreateExpense = () => {
    createExpense({
      variables: {
        input: {
          type: newExpense.type,
          amount: parseFloat(newExpense.amount),
          date: newExpense.date,
          description: newExpense.description || undefined,
          marketplace: newExpense.marketplace || undefined,
        },
      },
    });
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
      deleteExpense({ variables: { id } });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const stats = data?.getExpenseStats;
  const expenses = data?.getExpenses;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
          <p className="text-muted-foreground">
            Gerencie todas as despesas do seu negócio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Despesa
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? '...' : formatCurrency(stats?.totalExpenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maior Categoria</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : expenseTypeLabels[stats?.byType?.[0]?.type] || '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.byType?.[0]?.percentage?.toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading
                ? '...'
                : formatCurrency(
                    (stats?.totalExpenses || 0) / Math.max(stats?.byMonth?.length || 1, 1)
                  )}
            </div>
            <p className="text-xs text-muted-foreground">Baseado no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : expenses?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Despesas registradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Expense by Type Chart */}
      {stats?.byType && stats.byType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.byType.map((item: any) => (
                <div key={item.type} className="flex items-center gap-4">
                  <div className="w-32">
                    <Badge className={expenseTypeColors[item.type]}>
                      {expenseTypeLabels[item.type]}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                    <span className="text-muted-foreground ml-2">
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-40"
              />
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-40"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">Todas as categorias</option>
              <option value="ADS">Publicidade</option>
              <option value="FREIGHT">Frete</option>
              <option value="PRODUCT_COST">Custo de Produto</option>
              <option value="STORAGE">Armazenagem</option>
              <option value="OTHER">Outros</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : expenses?.items?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma despesa encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Data</th>
                    <th className="text-left py-3 px-4 font-medium">Categoria</th>
                    <th className="text-left py-3 px-4 font-medium">Descrição</th>
                    <th className="text-left py-3 px-4 font-medium">Marketplace</th>
                    <th className="text-right py-3 px-4 font-medium">Valor</th>
                    <th className="text-right py-3 px-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses?.items?.map((expense: any) => (
                    <tr key={expense.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{formatDate(expense.date)}</td>
                      <td className="py-3 px-4">
                        <Badge className={expenseTypeColors[expense.type]}>
                          {expenseTypeLabels[expense.type]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{expense.description || '-'}</td>
                      <td className="py-3 px-4">{expense.marketplace || '-'}</td>
                      <td className="py-3 px-4 text-right font-medium text-red-600">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Expense Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Nova Despesa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select
                  value={newExpense.type}
                  onChange={(e) => setNewExpense({ ...newExpense, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                >
                  <option value="ADS">Publicidade</option>
                  <option value="FREIGHT">Frete</option>
                  <option value="PRODUCT_COST">Custo de Produto</option>
                  <option value="STORAGE">Armazenagem</option>
                  <option value="OTHER">Outros</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Valor (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data</label>
                <Input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder="Descrição da despesa"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Marketplace (opcional)</label>
                <select
                  value={newExpense.marketplace}
                  onChange={(e) => setNewExpense({ ...newExpense, marketplace: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                >
                  <option value="">Nenhum</option>
                  <option value="AMAZON">Amazon</option>
                  <option value="MERCADO_LIVRE">Mercado Livre</option>
                  <option value="SHOPEE">Shopee</option>
                  <option value="MAGALU">Magalu</option>
                  <option value="AMERICANAS">Americanas</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateExpense} disabled={creating || !newExpense.amount}>
                  {creating ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
