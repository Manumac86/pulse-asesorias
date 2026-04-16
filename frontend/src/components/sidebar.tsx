'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Network, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Definimos las rutas de navegacion como datos, no como JSX.
// Si manana hay una nueva seccion, solo anadir un objeto aqui.
const navItems = [
  {
    label: 'Asesorías',
    href: '/',
    icon: Building2,
    description: 'Listado y detalle',
  },
  {
    label: 'Red',
    href: '/red',
    icon: Network,
    description: 'Vision agregada',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Determina si un nav item esta activo.
  // "/" es exacto, "/red" matchea si el pathname empieza por "/red".
  // "/asesorias/3" matchea "/" porque es la seccion de asesorias.
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname.startsWith('/asesorias');
    }
    return pathname.startsWith(href);
  };

  const navContent = (
    <nav className="flex flex-col gap-1 p-3">
      {/* Logo / Titulo */}
      <div className="mb-6 px-3 pt-2">
        <h1 className="text-xl font-bold tracking-tight">Pulse</h1>
        <p className="text-xs text-muted-foreground">Red de Asesorías</p>
      </div>

      {/* Nav items */}
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Boton hamburguesa — solo visible en mobile */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 rounded-lg bg-background p-2 shadow-md md:hidden"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay para mobile — cubre el contenido cuando el menu esta abierto */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar desktop — siempre visible en md+ */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-background">
        {navContent}
      </aside>

      {/* Sidebar mobile — slide-in desde la izquierda */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-56 bg-background shadow-xl transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="pt-14">{navContent}</div>
      </aside>
    </>
  );
}
