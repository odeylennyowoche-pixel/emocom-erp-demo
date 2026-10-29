import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  FilePenLine,
  FolderKanban,
  Gauge,
  Handshake,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
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
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, module: 'dashboard' },
      { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, module: 'approvals' },
    ],
  },
  {
    label: 'My work',
    items: [
      { to: '/workspace', label: 'My workspace', icon: Gauge, module: 'workspace' },
      { to: '/proposals', label: 'Proposals & quotes', icon: FilePenLine, module: 'proposals' },
    ],
  },
  {
    label: 'Sales & delivery',
    items: [
      { to: '/sales', label: 'Sales & CRM', icon: Handshake, module: 'sales' },
      { to: '/projects', label: 'Projects', icon: FolderKanban, module: 'projects' },
      { to: '/team', label: 'My team', icon: UserCog, module: 'team' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/hr', label: 'Human resources', icon: Users, module: 'hr' },
      { to: '/employees', label: 'Employees', icon: Users, module: 'employees' },
    ],
  },
  {
    label: 'Finance & operations',
    items: [
      { to: '/finance', label: 'Finance', icon: Wallet, module: 'finance' },
      { to: '/procurement', label: 'Purchasing', icon: ShoppingCart, module: 'procurement' },
      { to: '/inventory', label: 'Inventory & assets', icon: Boxes, module: 'inventory' },
      { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin', label: 'Administration', icon: ShieldCheck, module: 'admin' },
      { to: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
    ],
  },
]

/** Labels for static path segments used by breadcrumbs. */
export const SEGMENT_LABELS: Record<string, { label: string; to?: string }> = {
  employees: { label: 'Employees' },
  inventory: { label: 'Inventory & assets' },
  items: { label: 'Items', to: '/inventory' },
  procurement: { label: 'Purchasing' },
  requests: { label: 'Requisitions', to: '/procurement' },
  finance: { label: 'Finance' },
  invoices: { label: 'Invoices', to: '/finance?tab=receivables' },
  reports: { label: 'Reports' },
  settings: { label: 'Settings' },
  search: { label: 'Search results' },
  approvals: { label: 'Approvals' },
  workspace: { label: 'My workspace' },
  proposals: { label: 'Proposals & quotes' },
  sales: { label: 'Sales & CRM' },
  projects: { label: 'Projects' },
  team: { label: 'My team' },
  hr: { label: 'Human resources' },
  admin: { label: 'Administration' },
  new: { label: 'New' },
  edit: { label: 'Edit' },
}
