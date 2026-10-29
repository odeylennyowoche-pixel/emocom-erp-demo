import { lazy, type ComponentType } from 'react'
import { createHashRouter } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { RouteError, NotFoundPage } from './RouteError'
import { ModuleGuard } from '../features/auth/Guards'
import LoginPage from '../features/auth/LoginPage'

/**
 * Lazy-load a page. If its file can no longer be fetched (for example the dev
 * server restarted or a new version was deployed), reload the page once
 * instead of showing an error.
 */
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      const mod = await load()
      sessionStorage.removeItem('enterpriseone.chunk-reload')
      return mod
    } catch (err) {
      if (!sessionStorage.getItem('enterpriseone.chunk-reload')) {
        sessionStorage.setItem('enterpriseone.chunk-reload', '1')
        window.location.reload()
        return new Promise<never>(() => {})
      }
      throw err
    }
  })
}

// Each module is code-split so the first load stays fast.
const DashboardPage = lazyPage(() => import('../features/dashboard/DashboardPage'))
const EmployeesPage = lazyPage(() => import('../features/employees/EmployeesPage'))
const EmployeeDetailPage = lazyPage(() => import('../features/employees/EmployeeDetailPage'))
const EmployeeFormPage = lazyPage(() => import('../features/employees/EmployeeFormPage'))
const InventoryPage = lazyPage(() => import('../features/inventory/InventoryPage'))
const ItemDetailPage = lazyPage(() => import('../features/inventory/ItemDetailPage'))
const ItemFormPage = lazyPage(() => import('../features/inventory/ItemFormPage'))
const ProcurementPage = lazyPage(() => import('../features/procurement/ProcurementPage'))
const RequestDetailPage = lazyPage(() => import('../features/procurement/RequestDetailPage'))
const RequestFormPage = lazyPage(() => import('../features/procurement/RequestFormPage'))
const FinancePage = lazyPage(() => import('../features/finance/FinancePage'))
const InvoiceDetailPage = lazyPage(() => import('../features/finance/InvoiceDetailPage'))
const ReportsPage = lazyPage(() => import('../features/reports/ReportsPage'))
const SettingsPage = lazyPage(() => import('../features/settings/SettingsPage'))
const SearchPage = lazyPage(() => import('../features/search/SearchPage'))

// Hash-based URLs (/#/employees) so the demo works on any static host, e.g. GitHub Pages.
export const router = createHashRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'employees', element: <ModuleGuard module="employees"><EmployeesPage /></ModuleGuard> },
      { path: 'employees/new', element: <ModuleGuard module="employees"><EmployeeFormPage /></ModuleGuard> },
      { path: 'employees/:id', element: <ModuleGuard module="employees"><EmployeeDetailPage /></ModuleGuard> },
      { path: 'employees/:id/edit', element: <ModuleGuard module="employees"><EmployeeFormPage /></ModuleGuard> },
      { path: 'inventory', element: <ModuleGuard module="inventory"><InventoryPage /></ModuleGuard> },
      { path: 'inventory/items/new', element: <ModuleGuard module="inventory"><ItemFormPage /></ModuleGuard> },
      { path: 'inventory/items/:id', element: <ModuleGuard module="inventory"><ItemDetailPage /></ModuleGuard> },
      { path: 'inventory/items/:id/edit', element: <ModuleGuard module="inventory"><ItemFormPage /></ModuleGuard> },
      { path: 'procurement', element: <ModuleGuard module="procurement"><ProcurementPage /></ModuleGuard> },
      { path: 'procurement/requests/new', element: <ModuleGuard module="procurement"><RequestFormPage /></ModuleGuard> },
      { path: 'procurement/requests/:id', element: <ModuleGuard module="procurement"><RequestDetailPage /></ModuleGuard> },
      { path: 'procurement/requests/:id/edit', element: <ModuleGuard module="procurement"><RequestFormPage /></ModuleGuard> },
      { path: 'finance', element: <ModuleGuard module="finance"><FinancePage /></ModuleGuard> },
      { path: 'finance/invoices/:id', element: <ModuleGuard module="finance"><InvoiceDetailPage /></ModuleGuard> },
      { path: 'reports', element: <ModuleGuard module="reports"><ReportsPage /></ModuleGuard> },
      { path: 'settings', element: <ModuleGuard module="settings"><SettingsPage /></ModuleGuard> },
      { path: 'search', element: <SearchPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
