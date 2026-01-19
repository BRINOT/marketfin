'use client';

import { useQuery } from '@apollo/client';
import { MarketplaceCard } from '@/components/integrations/MarketplaceCard';
import { GET_INTEGRATIONS } from '@/lib/graphql/queries';
import { Loader2 } from 'lucide-react';

const MARKETPLACES = [
  {
    id: 'MERCADO_LIVRE',
    name: 'Mercado Livre',
    description: 'Conecte sua conta do Mercado Livre para sincronizar pedidos automaticamente.',
    logo: '/logos/mercado-livre.svg',
    color: 'bg-yellow-500',
  },
  {
    id: 'AMAZON',
    name: 'Amazon',
    description: 'Integre com a Amazon Seller Central para importar seus pedidos.',
    logo: '/logos/amazon.svg',
    color: 'bg-orange-500',
  },
  {
    id: 'SHOPEE',
    name: 'Shopee',
    description: 'Sincronize suas vendas da Shopee automaticamente.',
    logo: '/logos/shopee.svg',
    color: 'bg-orange-600',
  },
  {
    id: 'MAGALU',
    name: 'Magazine Luiza',
    description: 'Conecte sua loja do Magalu Marketplace.',
    logo: '/logos/magalu.svg',
    color: 'bg-blue-600',
  },
  {
    id: 'AMERICANAS',
    name: 'Americanas',
    description: 'Integre com o marketplace da Americanas.',
    logo: '/logos/americanas.svg',
    color: 'bg-red-600',
  },
];

export default function IntegrationsPage() {
  const { data, loading, refetch } = useQuery(GET_INTEGRATIONS);

  const getIntegrationStatus = (marketplaceId: string) => {
    const integration = data?.getIntegrations?.find(
      (i: any) => i.marketplace === marketplaceId
    );
    return integration || null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
        <p className="text-gray-500 mt-1">
          Conecte seus marketplaces para sincronizar pedidos automaticamente
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Marketplace Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MARKETPLACES.map((marketplace) => (
            <MarketplaceCard
              key={marketplace.id}
              marketplace={marketplace}
              integration={getIntegrationStatus(marketplace.id)}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900">Precisa de ajuda?</h3>
        <p className="text-blue-700 mt-2">
          Consulte nossa documentação para saber como configurar cada integração.
          Se tiver dúvidas, entre em contato com nosso suporte.
        </p>
      </div>
    </div>
  );
}
