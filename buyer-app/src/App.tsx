import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { ToastProvider } from './components/Toast';

// Bottom Nav faqat asosiy 4 ta tab sahifalarida ko'rinadi.
// Detail sahifalar (/products/:pid, /orders/:code) — yashirin (immersive).
const MAIN_ROUTES = ['/', '/wishlist', '/orders', '/profile'];

// Code-split per route — har ekran alohida chunk, initial JS kichraytadi.
const HomeScreen          = lazy(() => import('./screens/HomeScreen').then((m) => ({ default: m.HomeScreen })));
const WishlistScreen      = lazy(() => import('./screens/WishlistScreen').then((m) => ({ default: m.WishlistScreen })));
const OrdersScreen        = lazy(() => import('./screens/OrdersScreen').then((m) => ({ default: m.OrdersScreen })));
const OrderDetailScreen   = lazy(() => import('./screens/OrderDetailScreen').then((m) => ({ default: m.OrderDetailScreen })));
const ProductDetailScreen = lazy(() => import('./screens/ProductDetailScreen').then((m) => ({ default: m.ProductDetailScreen })));
const ProfileScreen       = lazy(() => import('./screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen })));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-2">
      <div
        className="w-10 h-10 rounded-full border-[3px] border-brand-subtle border-t-brand"
        style={{ animation: 'spin 0.8s linear infinite' }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const showBottomNav = MAIN_ROUTES.includes(location.pathname);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/"                element={<HomeScreen />} />
          <Route path="/wishlist"        element={<WishlistScreen />} />
          <Route path="/orders"          element={<OrdersScreen />} />
          <Route path="/orders/:code"    element={<OrderDetailScreen />} />
          <Route path="/products/:pid"   element={<ProductDetailScreen />} />
          <Route path="/profile"         element={<ProfileScreen />} />
          <Route path="*"                element={<HomeScreen />} />
        </Routes>
      </Suspense>
      {showBottomNav && <BottomNav />}
      <OfflineBanner />
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ToastProvider>
  );
}
