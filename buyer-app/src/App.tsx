import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { WishlistScreen } from './screens/WishlistScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { BottomNav } from './components/BottomNav';

function AppShell() {
  return (
    <>
      <Routes>
        <Route path="/"         element={<HomeScreen />} />
        <Route path="/wishlist" element={<WishlistScreen />} />
        <Route path="/orders"   element={<OrdersScreen />} />
        <Route path="/profile"  element={<ProfileScreen />} />
        <Route path="*"         element={<HomeScreen />} />
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
