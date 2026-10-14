import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from '../features/auth/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import PublicLayout from '../layouts/PublicLayout'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import RegisterPage from '../pages/RegisterPage'
import RoleHomePage from '../pages/RoleHomePage'
import UserDashboardPage from '../pages/user/UserDashboardPage'
import VehiclesPage from '../pages/user/VehiclesPage'
import WalletPage from '../pages/user/WalletPage'
import PlazasPage from '../pages/admin/PlazasPage'
import TollSimulatorPage from '../pages/operator/TollSimulatorPage'
import TransactionsPage from '../pages/TransactionsPage'
import TransactionDetailPage from '../pages/TransactionDetailPage'
import NotificationsPage from '../pages/user/NotificationsPage'
import UsersPage from '../pages/admin/UsersPage'
import DashboardPage from '../pages/DashboardPage'

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Must be logged in for everything below
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            element: <ProtectedRoute allowedRoles={['USER']} />,
            children: [
              { path: '/app', element: <UserDashboardPage /> },
              { path: '/app/vehicles', element: <VehiclesPage /> },
              { path: '/app/wallet', element: <WalletPage /> },
              { path: '/app/transactions', element: <TransactionsPage /> },
              { path: '/app/transactions/:id', element: <TransactionDetailPage /> },
              { path: '/app/notifications', element: <NotificationsPage /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={['OPERATOR', 'ADMIN']} />,
            children: [
              { path: '/operator', element: <TollSimulatorPage /> },
              { path: '/operator/transactions', element: <TransactionsPage /> },
              { path: '/operator/transactions/:id', element: <TransactionDetailPage /> },
              { path: '/operator/dashboard', element: <DashboardPage /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={['ADMIN']} />,
            children: [
              { path: '/admin', element: <DashboardPage  /> },
              { path: '/admin/plazas', element: <PlazasPage /> },
              { path: '/admin/transactions', element: <TransactionsPage /> },
              { path: '/admin/transactions/:id', element: <TransactionDetailPage /> },
              { path: '/admin/users', element: <UsersPage /> },
            ],
          },
        ],
      },
    ],
  },
])