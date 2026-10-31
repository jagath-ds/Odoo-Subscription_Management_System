import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useSession } from '@/mocks/store/AppStore'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import {
  DiscountRulesPage,
  PlansPage,
  ProductsPage,
  QuotationTemplatesPage,
  TaxRulesPage,
} from '@/pages/catalog'
import { ForbiddenPage, NotFoundPage } from '@/pages/errors'
import { BillingDayPage } from '@/pages/BillingDayPage'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { InvoiceDetailPage } from '@/pages/InvoiceDetailPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { SubscriptionDetailPage } from '@/pages/SubscriptionDetailPage'
import { NewQuotationPage } from '@/pages/NewQuotationPage'
import { TeamPage } from '@/pages/TeamPage'
import { PortalHomePage, PortalInvoicesPage } from '@/pages/portal'
import type { Role } from '@/types/contracts'
import { homeForRole } from '@/types/nav'

function RequireAuth({ children }: { children: ReactElement }) {
  const session = useSession()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

function RequireRole({ allow, children }: { allow: Role[]; children: ReactElement }) {
  const session = useSession()

  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!allow.includes(session.role)) {
    return <Navigate to="/forbidden" replace />
  }
  return children
}

function HomeRedirect() {
  const session = useSession()
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={homeForRole(session.role)} replace />
}

const INTERNAL: Role[] = ['ADMIN', 'STAFF']

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />

        <Route
          path="dashboard"
          element={
            <RequireRole allow={INTERNAL}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="billing"
          element={
            <RequireRole allow={INTERNAL}>
              <BillingDayPage />
            </RequireRole>
          }
        />
        <Route
          path="subscriptions"
          element={
            <RequireRole allow={INTERNAL}>
              <SubscriptionsPage />
            </RequireRole>
          }
        />
        <Route
          path="subscriptions/:id"
          element={
            // Customers open their own subscriptions from the portal (pause / resume / renew,
            // add-ons); the API enforces ownership and which transitions a customer may make.
            <RequireRole allow={['ADMIN', 'STAFF', 'CUSTOMER']}>
              <SubscriptionDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="quotations/new"
          element={
            <RequireRole allow={INTERNAL}>
              <NewQuotationPage />
            </RequireRole>
          }
        />
        <Route
          path="invoices"
          element={
            <RequireRole allow={INTERNAL}>
              <InvoicesPage />
            </RequireRole>
          }
        />
        <Route
          path="invoices/:id"
          element={
            <RequireRole allow={INTERNAL}>
              <InvoiceDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="payments"
          element={
            <RequireRole allow={INTERNAL}>
              <PaymentsPage />
            </RequireRole>
          }
        />

        <Route
          path="catalog/products"
          element={
            <RequireRole allow={['ADMIN']}>
              <ProductsPage />
            </RequireRole>
          }
        />
        <Route
          path="catalog/plans"
          element={
            <RequireRole allow={['ADMIN']}>
              <PlansPage />
            </RequireRole>
          }
        />
        <Route
          path="catalog/tax-rules"
          element={
            <RequireRole allow={['ADMIN']}>
              <TaxRulesPage />
            </RequireRole>
          }
        />
        <Route
          path="catalog/discount-rules"
          element={
            <RequireRole allow={['ADMIN']}>
              <DiscountRulesPage />
            </RequireRole>
          }
        />
        <Route
          path="catalog/quotation-templates"
          element={
            <RequireRole allow={['ADMIN']}>
              <QuotationTemplatesPage />
            </RequireRole>
          }
        />
        <Route
          path="team"
          element={
            <RequireRole allow={['ADMIN']}>
              <TeamPage />
            </RequireRole>
          }
        />

        <Route path="portal" element={<PortalHomePage />} />
        <Route path="portal/invoices" element={<PortalInvoicesPage />} />

        <Route path="forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
