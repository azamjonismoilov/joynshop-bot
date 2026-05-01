import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { OrderDetailScreen } from './screens/OrderDetailScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { CustomerDetailScreen } from './screens/CustomerDetailScreen';
import { CustomerHistoryScreen } from './screens/CustomerHistoryScreen';
import { UIShowcase } from './screens/UIShowcase';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                          element={<DashboardScreen />} />
        <Route path="/products"                  element={<ProductsScreen />} />
        <Route path="/orders"                    element={<OrdersScreen />} />
        <Route path="/orders/:code"              element={<OrderDetailScreen />} />
        <Route path="/customers"                 element={<CustomersScreen />} />
        <Route path="/customers/:id"             element={<CustomerDetailScreen />} />
        <Route path="/customers/:id/history"     element={<CustomerHistoryScreen />} />
        <Route path="/showcase"                  element={<UIShowcase />} />
        {/* Default fallback */}
        <Route path="*"                          element={<DashboardScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
