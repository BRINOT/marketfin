'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Link2,
  FileBarChart,
  Package,
  ShoppingCart,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Integrações', href: '/integrations', icon: Link2 },
  { name: 'Relatórios', href: '/reports', icon: FileBarChart },
  { name: 'Pedidos', href: '/orders', icon: ShoppingCart },
  { name: 'Produtos', href: '/products', icon: Package },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold text-gray-900">MarketFin</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-primary'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-5 w-5 shrink-0',
                            isActive ? 'text-primary' : 'text-gray-400 group-hover:text-primary'
                          )}
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}n              </ul>
            </li>

            {/* Help & Support */}
            <li className="mt-auto">
              <Link
                href="/help"
                className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-primary"
              >
                <HelpCircle className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-primary" />
                Ajuda & Suporte
              </Link>
            </li>

            {/* User */}
            <li className="-mx-2 mt-2">
              <div className="flex items-center gap-x-3 rounded-md p-2 bg-gray-50">
                <UserButton afterSignOutUrl="/sign-in" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">Minha Conta</p>
                </div>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
