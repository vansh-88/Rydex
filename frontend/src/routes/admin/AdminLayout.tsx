import { Car, IdCard, Shield } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { cn } from '@/lib/cn';

const ADMIN_NAV = [
  { to: '/admin/driver-applications', label: 'Driver applications', icon: IdCard },
  { to: '/admin/vehicles', label: 'Vehicles', icon: Car },
];

// The admin console is not decoration: without it no driver and no vehicle can
// ever be approved, so the whole product is undemonstrable. It gets its own
// layout and nav to make clear the reviewer is in a different tool from the
// passenger-facing app, while reusing the same components throughout.
export function AdminLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border-subtle pb-4">
        <Shield className="size-5 text-accent-700" aria-hidden />
        <h1 className="text-xl font-semibold text-ink">Admin</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-50 text-accent-800'
                    : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
                )
              }
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
