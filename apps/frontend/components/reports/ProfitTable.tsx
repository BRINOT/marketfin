"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfitItem {
  id: string;
  name: string;
  category: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface ProfitTableProps {
  data: ProfitItem[];
  loading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
  }).format(value / 100);
}

export function ProfitTable({ data, loading }: ProfitTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado disponível para o período selecionado.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead className="text-right">Receita</TableHead>
          <TableHead className="text-right">Custo</TableHead>
          <TableHead className="text-right">Lucro</TableHead>
          <TableHead className="text-right">Margem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{item.category}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
            <TableCell className={`text-right ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(item.profit)}
            </TableCell>
            <TableCell className={`text-right ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(item.margin)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
