import { BarChart3, Boxes, LayoutDashboard, Settings, ShoppingCart, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { ModuleKey } from '../features/auth/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  module: ModuleKey
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, module: 'dashboard' }] },
  { label: 'People', items: [{ to: '/employees', label: 'Employees', icon: Users, module: 'employees' }] },
  {
    label: 'Operations',
    items: [
      { to: '/inventory', label: 'Inventory & Assets', icon: Boxes, module: 'inventory' },
      { to: '/procurement', label: 'Procurement', icon: ShoppingCart, module: 'procurement' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance', label: 'Finance', icon: Wallet, module: 'finance' },
      { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
    ],
  },
  { label: 'Administration', items: [{ to: '/settings', label: 'Settings', icon: Settings, module: 'settings' }] },
]

/** Labels for static path segments used by breadcrumbs. */
export const SEGMENT_LABELS: Record<string, { label: string; to?: string }> = {
  employees: { label: 'Employees' },
  inventory: { label: 'Inventory & Assets' },
  items: { label: 'Items', to: '/inventory' },
  procurement: { label: 'Procurement' },
  requests: { label: 'Purchase Requests', to: '/procurement' },
  finance: { label: 'Finance' },
  invoices: { label: 'Invoices', to: '/finance?tab=invoices' },
  reports: { label: 'Reports' },
  settings: { label: 'Settings' },
  search: { label: 'Search results' },
  new: { label: 'New' },
  edit: { label: 'Edit' },
}
