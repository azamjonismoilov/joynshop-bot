import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  RiHeart3Fill,
  RiShoppingBag3Fill,
  RiUser3Fill,
} from '@remixicon/react';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { BottomNav } from './components/BottomNav';

function AppShell() {
  return (
    <>
      <Routes>
        <Route path="/"          element={<HomeScreen />} />
        <Route
          path="/wishlist"
          element={
            <PlaceholderScreen
              tagline="Saqlanganlar"
              icon={<RiHeart3Fill size={36} />}
              title="Saqlangan mahsulotlar"
              hint="Sprint 3'da ulanadi — yoqtirgan mahsulotlaringiz ro'yxati."
            />
          }
        />
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
