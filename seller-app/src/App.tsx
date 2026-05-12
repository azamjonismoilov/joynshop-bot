import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { ProductDetailScreen } from './screens/ProductDetailScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { OrderDetailScreen } from './screens/OrderDetailScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { CustomerDetailScreen } from './screens/CustomerDetailScreen';
import { CustomerHistoryScreen } from './screens/CustomerHistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LegalScreen } from './screens/LegalScreen';
import { ShopsScreen } from './screens/ShopsScreen';
import { ShopDetailScreen } from './screens/ShopDetailScreen';
import { IntegrationsScreen } from './screens/IntegrationsScreen';
import { BillzIntegrationScreen } from './screens/BillzIntegrationScreen';
import { UIShowcase } from './screens/UIShowcase';
import { AppHeader } from './components/AppHeader';
import { OnboardingGate } from './components/OnboardingGate';
import { BottomNav } from './components/BottomNav';
import { ErrorState } from './components/ErrorState';
import { Skeleton, SkeletonStats } from './components/ui';
import { useSellerMe } from './api/seller';
import { cn } from './lib/cn';

const HIDE_NAV_PATTERNS: RegExp[] = [
  /^\/products\/[^/]+$/,
  /^\/orders\/[^/]+$/,
  /^\/customers\/[^/]+/,
  /^\/settings\/legal$/,
  /^\/settings\/shops\/[^/]+$/,
  /^\/settings\/integrations\/[^/]+$/,
  /^\/showcase$/,
];

function AppShell() {
  const me = useSellerMe();
  const { pathname } = useLocation();

  if (me.isLoading) return <FullScreenLoader />;
  if (me.isError)   return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  if (!me.data)     return <ErrorState error={new Error("Ma'lumot yo'q")} onRetry={() => me.refetch()} />;

  if (me.data.is_onboarded === false) {
    return <OnboardingGate me={me.data} />;
  }

  const showNav = !HIDE_NAV_PATTERNS.some((re) => re.test(pathname));

  return (
    <>
      <div className={cn(showNav && 'pb-16')}>
        <Routes>
          <Route path="/"                          element={<DashboardScreen />} />
          <Route path="/products"                  element={<ProductsScreen />} />
          <Route path="/products/:pid"             element={<ProductDetailScreen />} />
          <Route path="/orders"                    element={<OrdersScreen />} />
          <Route path="/orders/:code"              element={<OrderDetailScreen />} />
          <Route path="/customers"                 element={<CustomersScreen />} />
          <Route path="/customers/:id"             element={<CustomerDetailScreen />} />
          <Route path="/customers/:id/history"     element={<CustomerHistoryScreen />} />
          <Route path="/settings"                          element={<SettingsScreen />} />
          <Route path="/settings/legal"                    element={<LegalScreen />} />
          <Route path="/settings/shops"                    element={<ShopsScreen />} />
          <Route path="/settings/shops/:id"                element={<ShopDetailScreen />} />
          <Route path="/settings/integrations"             element={<IntegrationsScreen />} />
          <Route path="/settings/integrations/billz"       element={<BillzIntegrationScreen />} />
          <Route path="/showcase"                  element={<UIShowcase />} />
          {/* Default fallback */}
          <Route path="*"                          element={<DashboardScreen />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </>
  );
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline="Yuklanmoqda..." />
      <main className="px-4 mt-4 space-y-4">
        <section className="grid grid-cols-2 gap-3">
          <SkeletonStats />
          <SkeletonStats />
          <SkeletonStats />
          <SkeletonStats />
        </section>
        <Skeleton height={220} rounded="xl" />
      </main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
