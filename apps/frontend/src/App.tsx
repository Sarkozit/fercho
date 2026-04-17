import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import AuthGuard from './components/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import TableMap from './pages/TableMap';
import MobileTableMap from './pages/MobileTableMap';
import Reservations from './pages/Reservations';
import Products from './pages/Products';
import Expenses from './pages/Expenses';
import Sales from './pages/Sales';
import Config from './pages/Config';
import Inventory from './pages/Inventory';
import { useIsMobile } from './hooks/useIsMobile';

function TableMapRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileTableMap /> : <TableMap />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Dashboard Routes */}
      <Route element={<AuthGuard />}>
        <Route element={<DashboardLayout />}>
          {/* Accessible to ALL roles */}
          <Route path="/" element={<TableMapRoute />} />

          {/* ADMIN + CAJERO only */}
          <Route element={<AuthGuard allowedRoles={['ADMIN', 'CAJERO']} />}>
            <Route path="/reservas" element={<ErrorBoundary fallbackTitle="Reservas"><Reservations /></ErrorBoundary>} />
            <Route path="/ventas" element={<Sales />} />
            <Route path="/gastos" element={<Expenses />} />
            <Route path="/productos" element={<Products />} />
            <Route path="/inventario" element={<Inventory />} />
            <Route path="/caja" element={<div className="p-8">Caja (Próximamente)</div>} />
            <Route path="/config" element={<Config />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
