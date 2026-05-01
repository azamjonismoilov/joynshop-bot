import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProductsScreen } from './screens/ProductsScreen';
import { UIShowcase } from './screens/UIShowcase';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProductsScreen />} />
        <Route path="/showcase" element={<UIShowcase />} />
        {/* Future: /products/:id, /orders, /customers, ... */}
        <Route path="*" element={<ProductsScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
