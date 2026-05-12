import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  RiShoppingBag3Fill,
  RiUser3Fill,
} from '@remixicon/react';
import { HomeScreen } from './screens/HomeScreen';
import { WishlistScreen } from './screens/WishlistScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { BottomNav } from './components/BottomNav';

function AppShell() {
  return (
    <>
      <Routes>
        <Route path="/"          element={<HomeScreen />} />
        <Route path="/wishlist" element={<WishlistScreen />} />
        <Route
          path="/orders"
          element={
            <PlaceholderScreen
              tagline="Buyurtmalarim"
              icon={<RiShoppingBag3Fill size={36} />}
              title="Buyurtmalaringiz"
              hint="Sprint 3'da ulanadi — barcha xaridlar tarixi va holatlar."
            />
          }
        />
        <Route
          path="/profile"
          element={
            <PlaceholderScreen
              tagline="Profilim"
              icon={<RiUser3Fill size={36} />}
              title="Profil"
              hint="Sprint 3'da ulanadi — statistika, cashback, referral."
            />
          }
        />
        {/* Fallback */}
        <Route path="*" element={<HomeScreen />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
