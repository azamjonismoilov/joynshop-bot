import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { UIShowcase } from './screens/UIShowcase';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<DashboardScreen />} />
        <Route path="/products"  element={<ProductsScreen />} />
        <Route path="/showcase"  element={<UIShowcase />} />
        {/* Default fallback */}
        <Route path="*"          element={<DashboardScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
