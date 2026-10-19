import {
  Building2,
  CalendarDays,
  ClipboardPen,
  FileText,
  HardHat,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ReceiptText,
  Settings,
  ShoppingCart,
  Tractor,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type NavKey =
  | 'dashboard'
  | 'daily'
  | 'expenses'
  | 'projects'
  | 'schedule'
  | 'workers'
  | 'assets'
  | 'purchases'
  | 'suppliers'
  | 'payroll'
  | 'reports'
  | 'documents'
  | 'settings'
  | 'guide';

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** Shown indented under the item before it (e.g. Expenses under Daily Entry). */
  sub?: boolean;
  /** Only active on exactly this path (its sub-items have their own entries). */
  exact?: boolean;
}

/** Sidebar items, in the order of overview §8. Labels come from messages `nav.<key>`. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'daily', href: '/daily', icon: ClipboardPen, exact: true },
  { key: 'expenses', href: '/daily/expenses', icon: Receipt, sub: true },
  { key: 'projects', href: '/projects', icon: Building2 },
  { key: 'schedule', href: '/schedule', icon: CalendarDays },
  { key: 'workers', href: '/workers', icon: HardHat },
  { key: 'assets', href: '/assets', icon: Tractor },
  { key: 'purchases', href: '/purchases', icon: ShoppingCart },
  { key: 'suppliers', href: '/suppliers', icon: Truck },
  { key: 'payroll', href: '/payroll', icon: Wallet },
  { key: 'reports', href: '/reports', icon: ReceiptText },
  { key: 'documents', href: '/documents', icon: FileText },
  { key: 'settings', href: '/settings', icon: Settings },
  { key: 'guide', href: '/guide', icon: LifeBuoy },
];

export function isActive(pathname: string, href: string, exact = false): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}
