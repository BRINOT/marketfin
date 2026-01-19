import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ApolloWrapper } from '@/lib/apollo-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MarketFin - Controle Financeiro Multi-Marketplace',
  description: 'Automatize o controle financeiro de suas vendas em múltiplos marketplaces',
  keywords: ['marketplace', 'financeiro', 'e-commerce', 'vendas', 'lucro'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body className={inter.className}>
          <ApolloWrapper>
            {children}
            <Toaster />
          </ApolloWrapper>
        </body>
      </html>
    </ClerkProvider>
  );
}
