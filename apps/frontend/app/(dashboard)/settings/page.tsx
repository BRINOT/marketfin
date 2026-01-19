'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Calculator,
  Bell,
  Shield,
  Building,
  Save,
  Check,
} from 'lucide-react';

const GET_SETTINGS = gql`
  query GetSettings {
    getTenantSettings {
      id
      name
      plan
      taxSettings {
        icmsRate
        pisCofinsRate
        issRate
        simpleNacionalRate
        taxRegime
      }
      notificationSettings {
        emailNotifications
        lowStockAlert
        lowStockThreshold
        dailyReport
        weeklyReport
      }
    }
  }
`;

const UPDATE_TAX_SETTINGS = gql`
  mutation UpdateTaxSettings($input: TaxSettingsInput!) {
    updateTaxSettings(input: $input) {
      icmsRate
      pisCofinsRate
      issRate
      simpleNacionalRate
      taxRegime
    }
  }
`;

const UPDATE_NOTIFICATION_SETTINGS = gql`
  mutation UpdateNotificationSettings($input: NotificationSettingsInput!) {
    updateNotificationSettings(input: $input) {
      emailNotifications
      lowStockAlert
      lowStockThreshold
      dailyReport
      weeklyReport
    }
  }
`;

const UPDATE_TENANT = gql`
  mutation UpdateTenant($input: UpdateTenantInput!) {
    updateTenant(input: $input) {
      id
      name
    }
  }
`;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [saved, setSaved] = useState(false);

  const { data, loading, refetch } = useQuery(GET_SETTINGS);

  const [companyName, setCompanyName] = useState('');
  const [taxSettings, setTaxSettings] = useState({
    icmsRate: 18,
    pisCofinsRate: 4.65,
    issRate: 5,
    simpleNacionalRate: 6,
    taxRegime: 'SIMPLES_NACIONAL',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    lowStockAlert: true,
    lowStockThreshold: 10,
    dailyReport: false,
    weeklyReport: true,
  });

  // Initialize state when data loads
  useState(() => {
    if (data?.getTenantSettings) {
      setCompanyName(data.getTenantSettings.name);
      if (data.getTenantSettings.taxSettings) {
        setTaxSettings(data.getTenantSettings.taxSettings);
      }
      if (data.getTenantSettings.notificationSettings) {
        setNotificationSettings(data.getTenantSettings.notificationSettings);
      }
    }
  });

  const [updateTaxSettings] = useMutation(UPDATE_TAX_SETTINGS, {
    onCompleted: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refetch();
    },
  });

  const [updateNotificationSettings] = useMutation(UPDATE_NOTIFICATION_SETTINGS, {
    onCompleted: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refetch();
    },
  });

  const [updateTenant] = useMutation(UPDATE_TENANT, {
    onCompleted: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refetch();
    },
  });

  const handleSaveTaxSettings = () => {
    updateTaxSettings({
      variables: {
        input: {
          icmsRate: parseFloat(String(taxSettings.icmsRate)),
          pisCofinsRate: parseFloat(String(taxSettings.pisCofinsRate)),
          issRate: parseFloat(String(taxSettings.issRate)),
          simpleNacionalRate: parseFloat(String(taxSettings.simpleNacionalRate)),
          taxRegime: taxSettings.taxRegime,
        },
      },
    });
  };

  const handleSaveNotificationSettings = () => {
    updateNotificationSettings({
      variables: {
        input: notificationSettings,
      },
    });
  };

  const handleSaveCompany = () => {
    updateTenant({
      variables: {
        input: { name: companyName },
      },
    });
  };

  const tabs = [
    { id: 'company', label: 'Empresa', icon: Building },
    { id: 'taxes', label: 'Impostos', icon: Calculator },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: Shield },
  ];

  const planLabels: Record<string, string> = {
    FREE: 'Gratuito',
    PRO: 'Profissional',
    ENTERPRISE: 'Empresarial',
  };

  const planColors: Record<string, string> = {
    FREE: 'bg-gray-100 text-gray-800',
    PRO: 'bg-blue-100 text-blue-800',
    ENTERPRISE: 'bg-purple-100 text-purple-800',
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações da sua conta
          </p>
        </div>
        {saved && (
          <Badge className="bg-green-100 text-green-800">
            <Check className="mr-1 h-3 w-3" />
            Salvo com sucesso
          </Badge>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {/* Company Settings */}
          {activeTab === 'company' && (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>
                  Configure as informações básicas da sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium">Nome da Empresa</label>
                    <Input
                      value={companyName || data?.getTenantSettings?.name || ''}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Nome da sua empresa"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Plano Atual</label>
                    <div className="mt-1">
                      <Badge className={planColors[data?.getTenantSettings?.plan || 'FREE']}>
                        {planLabels[data?.getTenantSettings?.plan || 'FREE']}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleSaveCompany}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tax Settings */}
          {activeTab === 'taxes' && (
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Impostos</CardTitle>
                <CardDescription>
                  Configure as alíquotas de impostos para cálculo do lucro líquido
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium">Regime Tributário</label>
                  <select
                    value={taxSettings.taxRegime}
                    onChange={(e) =>
                      setTaxSettings({ ...taxSettings, taxRegime: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  >
                    <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                    <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                    <option value="LUCRO_REAL">Lucro Real</option>
                    <option value="MEI">MEI</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">ICMS (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={taxSettings.icmsRate}
                      onChange={(e) =>
                        setTaxSettings({ ...taxSettings, icmsRate: parseFloat(e.target.value) })
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Imposto sobre Circulação de Mercadorias
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">PIS/COFINS (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={taxSettings.pisCofinsRate}
                      onChange={(e) =>
                        setTaxSettings({
                          ...taxSettings,
                          pisCofinsRate: parseFloat(e.target.value),
                        })
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Contribuições federais
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">ISS (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={taxSettings.issRate}
                      onChange={(e) =>
                        setTaxSettings({ ...taxSettings, issRate: parseFloat(e.target.value) })
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Imposto sobre Serviços (se aplicável)
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Simples Nacional (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={taxSettings.simpleNacionalRate}
                      onChange={(e) =>
                        setTaxSettings({
                          ...taxSettings,
                          simpleNacionalRate: parseFloat(e.target.value),
                        })
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Alíquota do Simples Nacional
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900">Como funciona o cálculo</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    O lucro líquido é calculado subtraindo do valor total da venda: comissões do
                    marketplace, frete, custo do produto e impostos configurados acima.
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleSaveTaxSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Configurações de Impostos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Notificações</CardTitle>
                <CardDescription>
                  Configure como e quando você deseja receber notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-medium">Notificações por E-mail</label>
                      <p className="text-sm text-muted-foreground">
                        Receba atualizações importantes por e-mail
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          emailNotifications: e.target.checked,
                        })
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-medium">Alerta de Estoque Baixo</label>
                      <p className="text-sm text-muted-foreground">
                        Seja notificado quando produtos estiverem com estoque baixo
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.lowStockAlert}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          lowStockAlert: e.target.checked,
                        })
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  {notificationSettings.lowStockAlert && (
                    <div className="ml-4 pl-4 border-l">
                      <label className="text-sm font-medium">Limite de Estoque Baixo</label>
                      <Input
                        type="number"
                        value={notificationSettings.lowStockThreshold}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            lowStockThreshold: parseInt(e.target.value),
                          })
                        }
                        className="mt-1 w-32"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Alerta quando estoque for menor que este valor
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-medium">Relatório Diário</label>
                      <p className="text-sm text-muted-foreground">
                        Receba um resumo diário das suas vendas
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.dailyReport}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          dailyReport: e.target.checked,
                        })
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-medium">Relatório Semanal</label>
                      <p className="text-sm text-muted-foreground">
                        Receba um resumo semanal com análises detalhadas
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.weeklyReport}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          weeklyReport: e.target.checked,
                        })
                      }
                      className="h-5 w-5"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleSaveNotificationSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Configurações de Notificações
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Segurança e Privacidade</CardTitle>
                <CardDescription>
                  Gerencie a segurança da sua conta e dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium">Autenticação</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sua conta está protegida pelo Clerk com autenticação segura.
                    </p>
                    <Button variant="outline" className="mt-3">
                      Gerenciar Autenticação
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium">Sessões Ativas</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Visualize e gerencie dispositivos conectados à sua conta.
                    </p>
                    <Button variant="outline" className="mt-3">
                      Ver Sessões
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium">Exportar Dados (LGPD)</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Solicite uma cópia de todos os seus dados armazenados.
                    </p>
                    <Button variant="outline" className="mt-3">
                      Solicitar Exportação
                    </Button>
                  </div>

                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h4 className="font-medium text-red-900">Excluir Conta</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Esta ação é irreversível. Todos os seus dados serão permanentemente
                      excluídos.
                    </p>
                    <Button variant="destructive" className="mt-3">
                      Excluir Minha Conta
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
