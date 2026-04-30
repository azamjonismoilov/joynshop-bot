import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProductsScreen } from './screens/ProductsScreen';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProductsScreen />} />
        {/* Future: /products/:id, /orders, /customers, ... */}
        <Route path="*" element={<ProductsScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
