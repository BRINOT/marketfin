import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  Shield, 
  Zap, 
  Store, 
  TrendingUp, 
  Clock,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold">MarketFin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Começar Grátis</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Controle Financeiro para
          <span className="text-blue-600"> Marketplaces</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
          Automatize o cálculo de lucro líquido, taxas e impostos de todas as suas vendas 
          em Amazon, Mercado Livre, Shopee e mais.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2">
              Começar Grátis <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline">
              Ver Recursos
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          ✓ Sem cartão de crédito &nbsp; ✓ 1.000 pedidos grátis/mês
        </p>
      </section>

      {/* Marketplaces */}
      <section className="container mx-auto px-4 py-12">
        <p className="text-center text-gray-500 mb-8">Integrado com os principais marketplaces</p>
        <div className="flex justify-center gap-8 flex-wrap">
          {['Mercado Livre', 'Amazon', 'Shopee', 'Magazine Luiza', 'Americanas'].map((mp) => (
            <div key={mp} className="px-6 py-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{mp}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Tudo que você precisa</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: TrendingUp,
              title: 'Lucro Líquido Real',
              description: 'Cálculo automático considerando taxas, comissões, frete, impostos e custo do produto.',
            },
            {
              icon: Zap,
              title: 'Sincronização em Tempo Real',
              description: 'Webhooks e polling para manter seus dados sempre atualizados.',
            },
            {
              icon: Store,
              title: 'Multi-Marketplace',
              description: 'Gerencie todas as suas lojas em um único dashboard unificado.',
            },
            {
              icon: BarChart3,
              title: 'Relatórios Detalhados',
              description: 'Análises por período, marketplace, produto e muito mais.',
            },
            {
              icon: Shield,
              title: 'LGPD Compliant',
              description: 'Seus dados protegidos e em conformidade com a legislação.',
            },
            {
              icon: Clock,
              title: 'Economia de Tempo',
              description: 'Automatize horas de trabalho manual em planilhas.',
            },
          ].map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="w-10 h-10 text-blue-600 mb-2" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl">
        <h2 className="text-3xl font-bold text-center mb-4">Planos Simples</h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Comece grátis e escale conforme seu negócio cresce
        </p>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              name: 'Gratuito',
              price: 'R$0',
              features: ['Até 1.000 pedidos/mês', '1 marketplace', 'Relatórios básicos', 'Suporte por email'],
            },
            {
              name: 'Pro',
              price: 'R$49',
              popular: true,
              features: ['Até 10.000 pedidos/mês', 'Todos os marketplaces', 'Relatórios avançados', 'Exportação PDF/Excel', 'Suporte prioritário'],
            },
            {
              name: 'Enterprise',
              price: 'R$499',
              features: ['Pedidos ilimitados', 'API dedicada', 'Multi-usuários', 'Onboarding dedicado', 'SLA garantido'],
            },
          ].map((plan) => (
            <Card key={plan.name} className={plan.popular ? 'border-blue-600 border-2' : ''}>
              {plan.popular && (
                <div className="bg-blue-600 text-white text-center py-1 text-sm font-medium">
                  Mais Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="text-4xl font-bold">
                  {plan.price}<span className="text-lg font-normal text-gray-500">/mês</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up">
                  <Button className="w-full mt-6" variant={plan.popular ? 'default' : 'outline'}>
                    Começar Agora
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Pronto para ter controle total?</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Junte-se a milhares de vendedores que já automatizaram seu controle financeiro.
        </p>
        <Link href="/sign-up">
          <Button size="lg">Criar Conta Grátis</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <span className="font-bold">MarketFin</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-600">
              <Link href="/terms">Termos de Uso</Link>
              <Link href="/privacy">Privacidade</Link>
              <Link href="/contact">Contato</Link>
            </div>
            <p className="text-sm text-gray-500">
              © 2024 MarketFin. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
