import { RouterProvider } from 'react-router-dom'
import { ToastProvider } from '../components/ui/ToastProvider'
import { DataProvider } from '../data/DataProvider'
import { router } from './router'

export function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <RouterProvider router={router} />
      </DataProvider>
    </ToastProvider>
  )
}
