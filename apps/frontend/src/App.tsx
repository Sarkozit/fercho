import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import AuthGuard from './components/AuthGuard';
import TableMap from './pages/TableMap';
import Reservations from './pages/Reservations';
import Products from './pages/Products';
import Expenses from './pages/Expenses';
import Sales from './pages/Sales';
import Config from './pages/Config';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Dashboard Routes */}
      <Route element={<AuthGuard />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<TableMap />} />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/gastos" element={<Expenses />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/caja" element={<div className="p-8">Caja (Próximamente)</div>} />
          <Route path="/config" element={<Config />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
