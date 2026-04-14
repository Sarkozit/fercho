import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  UtensilsCrossed, 
  TrendingUp, 
  Coffee, 
  Settings,
  User,
  Calculator,
  Wallet,
  LogOut,
  ChevronDown,
  Printer,
  CalendarDays
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore } from '../store/expenseStore';
import { useNotificationStore } from '../store/notificationStore';
import { printAgent } from '../services/printAgent';
import NotificationBell from '../components/NotificationBell';
import { useIsMobile } from '../hooks/useIsMobile';
import { io } from 'socket.io-client';

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Create a reactive time state
  const [time, setTime] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [printStatus, setPrintStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  const { dailyBalance, fetchDailyBalance } = useExpenseStore();

  useEffect(() => {
    fetchDailyBalance();
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    const socket = io(socketUrl, { path: '/api/socket.io/' });
    
    socket.on('table_updated', () => {
      fetchDailyBalance();
    });
    
    socket.on('expense_updated', () => {
      fetchDailyBalance();
    });

    // Listen for new notifications in real-time
    const notifStore = useNotificationStore.getState();
    socket.on('new_notification', (notification: any) => {
      notifStore.addNotification(notification);
    });

    // Request browser notification permission
    notifStore.requestBrowserPermission();

    const timer = setInterval(() => {
      setTime(new Date());
      fetchDailyBalance();
    }, 60000); // Update every minute
    
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [fetchDailyBalance]);

  // Print Agent status listener
  useEffect(() => {
    return printAgent.onStatusChange(setPrintStatus);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Create Spanish date formatting manually for exact match: "MIÉRCOLES 25 MAR."
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'];
  
  const dayName = days[time.getDay()];
  const dayNumber = time.getDate();
  const monthName = months[time.getMonth()];

  const allNavItems = [
    { icon: <UtensilsCrossed className="h-6 w-6" />, path: '/', roles: ['ADMIN', 'CAJERO', 'MESERO'] },
    { icon: <CalendarDays className="h-6 w-6" />, path: '/reservas', roles: ['ADMIN', 'CAJERO'] },
    { icon: <TrendingUp className="h-6 w-6" />, path: '/ventas', roles: ['ADMIN', 'CAJERO'] },
    { icon: <Wallet className="h-6 w-6" />, path: '/gastos', roles: ['ADMIN', 'CAJERO'] },
    { icon: <Coffee className="h-6 w-6" />, path: '/productos', roles: ['ADMIN', 'CAJERO'] },
    { icon: <Settings className="h-6 w-6" />, path: '/config', roles: ['ADMIN', 'CAJERO'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(user?.role || ''));

  // ── Mobile Layout ──
  if (isMobile) {
    const isReservas = location.pathname === '/reservas';
    return (
      <div className="flex flex-col h-screen w-full bg-gray-100 font-sans text-gray-800">
        {/* Mesas / Reservas tab bar — only on /reservas */}
        {isReservas && (
          <div className="flex flex-shrink-0 border-b border-gray-200">
            <Link
              to="/"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition text-gray-500 bg-gray-50"
            >
              <UtensilsCrossed className="h-4 w-4" />
              Mesas
            </Link>
            <Link
              to="/reservas"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition text-white bg-[#ff5a5f]"
            >
              <CalendarDays className="h-4 w-4" />
              Reservas
            </Link>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-gray-400 bg-gray-50 border-l border-gray-200 transition active:bg-gray-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        <main className="flex-1 flex flex-col overflow-hidden w-full">
          <Outlet />
        </main>
      </div>
    );
  }

  // ── Desktop Layout ──
  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-800">
      
      {/* Top Navigation Bar - Fudo Clone Style */}
      <header className="bg-white border-b-[4px] border-[#ff5a5f] h-[60px] flex items-center justify-between shadow-sm z-50">
        
        {/* Left Section: Icons */}
        <div className="flex items-center h-full">
          {/* Logo spacer area */}
          <div className="w-40 h-full border-r border-gray-100 flex items-center px-6">
            <span className="text-[#ff5a5f] font-black text-2xl tracking-tighter uppercase italic">FERCHO</span>
          </div> 
          
          <nav className="flex h-full">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/productos' && location.pathname.includes('catalogo'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-6 h-full flex flex-col items-center justify-center transition-colors border-r border-gray-100 ${
                    isActive 
                      ? 'bg-[#ff5a5f] text-white shadow-inner' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Time, User, Icons */}
        <div className="flex items-center space-x-5 pr-6 h-full">
          
          {/* Date & Time Cluster */}
          <div className="flex items-center h-full pl-6">
            <div className="flex flex-col items-end text-right leading-none mr-3 h-full justify-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">
                {dayName}
              </span>
              <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wide">
                {dayNumber} {monthName}
              </span>
            </div>
            <span className="text-3xl font-light text-gray-600 tracking-tight">
              ${dailyBalance.totalSales.toLocaleString('es-CO')}
            </span>
          </div>

          {/* User Profile Info */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center border-l border-gray-200 pl-5 space-x-3 h-10 cursor-pointer hover:opacity-80 transition"
            >
              <div className="text-gray-600 rounded-full border border-gray-200 p-1.5 bg-gray-50">
                <User className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-tight justify-center text-left">
                <span className="text-[12px] font-bold text-gray-800">Fonda Caballo Loco</span>
                <span className="text-[11px] text-gray-500">{user?.name || 'johnnie'}</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[999] animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-800">{user?.name}</p>
                  <p className="text-xs text-gray-400">{user?.username}</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    user?.role === 'ADMIN' ? 'bg-red-50 text-red-600' :
                    user?.role === 'CAJERO' ? 'bg-blue-50 text-blue-600' :
                    'bg-green-50 text-green-600'
                  }`}>
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Print Agent Status + Notifications + Cash Register */}
          <div className="flex items-center pl-3 space-x-2">
            <div 
              className={`p-2 border rounded-md transition relative ${
                printStatus === 'connected'
                  ? 'border-green-300 bg-green-50 text-green-600'
                  : 'border-gray-200 text-gray-300'
              }`}
              title={printStatus === 'connected' ? 'Impresora conectada' : 'Impresora desconectada'}
            >
              <Printer className="h-5 w-5" />
              <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                printStatus === 'connected' ? 'bg-green-500' : 'bg-gray-300'
              }`} />
            </div>
            <NotificationBell />
            <button
              onClick={() => {
                if (printAgent.getStatus() === 'connected') {
                  printAgent.openDrawer();
                }
              }}
              className="flex items-center"
              title="Abrir caja registradora"
            >
              <div className={`p-2 border rounded-md cursor-pointer transition border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300`}>
                <Calculator className="h-5 w-5" />
              </div>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
