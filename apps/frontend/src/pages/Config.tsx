import React, { useState, useEffect } from 'react';
import {
  Printer as PrinterIcon,
  Users,
  Plus,
  X,
  Save,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  QrCode,
  Sliders,
  ChefHat,
  CreditCard,
  Percent,
  ArrowLeft,
  Building2,
  Phone,
} from 'lucide-react';
import { useConfigStore, type Printer, type UserItem, type Kitchen, type PaymentMethod, type Supplier } from '../store/configStore';
import { useAuthStore } from '../store/authStore';

type Section = 'printers' | 'users' | 'options';
type OptionsSubSection = null | 'tips' | 'kitchens' | 'paymentMethods' | 'suppliers' | 'import';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  MESERO: 'Mesero',
};

const Config: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'ADMIN';
  const [activeSection, setActiveSection] = useState<Section>('printers');
  const [optionsSubSection, setOptionsSubSection] = useState<OptionsSubSection>(null);

  // ===== PRINTERS STATE =====
  const {
    printers, fetchPrinters, createPrinter, updatePrinter, deletePrinter,
    printSettings, fetchPrintSettings, updatePrintSettings,
    users, fetchUsers, createUser, updateUser, deleteUser,
    appSettings, fetchAppSettings, updateAppSettings,
    kitchens, fetchKitchens, createKitchen, updateKitchen, deleteKitchen,
    paymentMethods, fetchPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
    suppliers, fetchSuppliers, createSupplier, updateSupplier, deleteSupplier,
  } = useConfigStore();

  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [showPrinterForm, setShowPrinterForm] = useState(false);
  const [printerForm, setPrinterForm] = useState({
    name: '', type: 'ticket', connectionType: 'USB', address: '',
    kitchens: [] as string[], printCommands: true, printInvoice: false, active: true,
  });

  // ===== PRINT SETTINGS STATE =====
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrText, setQrText] = useState('Si deseas pagar desde cualquier banco o billetera virtual, usa este QR');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // ===== USERS STATE =====
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '', password: '', confirmPassword: '', name: '',
    role: 'CAJERO' as 'ADMIN' | 'CAJERO' | 'MESERO', active: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [userError, setUserError] = useState('');

  // ===== APP SETTINGS STATE =====
  const [tipEnabled, setTipEnabled] = useState(true);
  const [tipThreshold, setTipThreshold] = useState('150000');
  const [tipPercent, setTipPercent] = useState('10');
  const [optionsSaved, setOptionsSaved] = useState(false);

  // ===== KITCHENS STATE =====
  const [selectedKitchen, setSelectedKitchen] = useState<Kitchen | null>(null);
  const [showKitchenForm, setShowKitchenForm] = useState(false);
  const [kitchenForm, setKitchenForm] = useState({ name: '', active: true });
  const [kitchenSaved, setKitchenSaved] = useState(false);
  const [kitchenError, setKitchenError] = useState('');

  // ===== PAYMENT METHODS STATE =====
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showPaymentMethodForm, setShowPaymentMethodForm] = useState(false);
  const [paymentMethodForm, setPaymentMethodForm] = useState({ name: '', active: true });
  const [paymentMethodSaved, setPaymentMethodSaved] = useState(false);
  const [paymentMethodError, setPaymentMethodError] = useState('');

  // ===== SUPPLIERS STATE =====
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', contactName: '', notes: '', active: true });
  const [supplierSaved, setSupplierSaved] = useState(false);
  const [supplierError, setSupplierError] = useState('');

  // ===== IMPORT STATE =====
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<{ created: number, skipped: number, categories: number, suppliers: number } | null>(null);
  const [importError, setImportError] = useState('');

  // Dynamic kitchens options for printer form
  const kitchenOptions = kitchens.filter(k => k.active).map(k => k.name);

  useEffect(() => {
    fetchPrinters();
    fetchPrintSettings();
    fetchUsers();
    fetchAppSettings();
    fetchKitchens();
    fetchPaymentMethods();
    fetchSuppliers();
  }, [fetchPrinters, fetchPrintSettings, fetchUsers, fetchAppSettings, fetchKitchens, fetchPaymentMethods, fetchSuppliers]);

  useEffect(() => {
    if (printSettings) {
      setHeaderText(printSettings.header);
      setFooterText(printSettings.footer);
      setQrImage(printSettings.qrImage);
      setQrText(printSettings.qrText || 'Si deseas pagar desde cualquier banco o billetera virtual, usa este QR');
    }
  }, [printSettings]);

  useEffect(() => {
    if (appSettings) {
      setTipEnabled(appSettings.tipEnabled);
      setTipThreshold(String(appSettings.tipThreshold));
      setTipPercent(String(appSettings.tipPercent));
    }
  }, [appSettings]);

  // ===== PRINTER HANDLERS =====
  const handleCreatePrinter = () => {
    setSelectedPrinter(null);
    setPrinterForm({
      name: '', type: 'ticket', connectionType: 'USB', address: '',
      kitchens: [], printCommands: true, printInvoice: false, active: true,
    });
    setShowPrinterForm(true);
    setShowPrintSettings(false);
  };

  const handleEditPrinter = (printer: Printer) => {
    setSelectedPrinter(printer);
    setPrinterForm({
      name: printer.name,
      type: printer.type,
      connectionType: printer.connectionType,
      address: printer.address || '',
      kitchens: printer.kitchens || [],
      printCommands: printer.printCommands,
      printInvoice: printer.printInvoice || false,
      active: printer.active,
    });
    setShowPrinterForm(true);
    setShowPrintSettings(false);
  };

  const handleSavePrinter = async () => {
    const data = {
      ...printerForm,
      address: printerForm.address || null,
    };
    if (selectedPrinter) {
      await updatePrinter(selectedPrinter.id, data);
    } else {
      await createPrinter(data);
    }
    setShowPrinterForm(false);
    setSelectedPrinter(null);
  };

  const handleDeletePrinter = async (id: string) => {
    if (confirm('¿Eliminar esta impresora?')) {
      await deletePrinter(id);
      setShowPrinterForm(false);
      setSelectedPrinter(null);
    }
  };

  const toggleKitchen = (kitchen: string) => {
    setPrinterForm(prev => ({
      ...prev,
      kitchens: prev.kitchens.includes(kitchen)
        ? prev.kitchens.filter(k => k !== kitchen)
        : [...prev.kitchens, kitchen],
    }));
  };

  // ===== PRINT SETTINGS HANDLERS =====
  const handleSaveSettings = async () => {
    await updatePrintSettings({ header: headerText, footer: footerText, qrImage, qrText });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setQrImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ===== USER HANDLERS =====
  const handleCreateUser = () => {
    setSelectedUser(null);
    setUserForm({
      username: '', password: '', confirmPassword: '', name: '',
      role: 'CAJERO', active: true,
    });
    setShowUserForm(true);
    setUserError('');
  };

  const handleEditUser = (user: UserItem) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      password: '',
      confirmPassword: '',
      name: user.name,
      role: user.role,
      active: user.active,
    });
    setShowUserForm(true);
    setUserError('');
  };

  const handleSaveUser = async () => {
    setUserError('');

    if (!userForm.username.trim() || !userForm.name.trim()) {
      setUserError('Usuario y Nombre son obligatorios');
      return;
    }

    if (!selectedUser && !userForm.password) {
      setUserError('La contraseña es obligatoria al crear un usuario');
      return;
    }

    if (userForm.password && userForm.password !== userForm.confirmPassword) {
      setUserError('Las contraseñas no coinciden');
      return;
    }

    const data: any = {
      username: userForm.username,
      name: userForm.name,
      role: userForm.role,
      active: userForm.active,
    };
    if (userForm.password) {
      data.password = userForm.password;
    }

    try {
      if (selectedUser) {
        await updateUser(selectedUser.id, data);
      } else {
        await createUser(data);
      }
      setShowUserForm(false);
      setSelectedUser(null);
    } catch (err: any) {
      setUserError(err?.response?.data?.message || 'Error al guardar');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('¿Desactivar este usuario?')) {
      await deleteUser(id);
      setShowUserForm(false);
      setSelectedUser(null);
    }
  };

  // ===== KITCHEN HANDLERS =====
  const handleCreateKitchen = () => {
    setSelectedKitchen(null);
    setKitchenForm({ name: '', active: true });
    setShowKitchenForm(true);
    setKitchenSaved(false);
    setKitchenError('');
  };

  const handleEditKitchen = (kitchen: Kitchen) => {
    setSelectedKitchen(kitchen);
    setKitchenForm({ name: kitchen.name, active: kitchen.active });
    setShowKitchenForm(true);
    setKitchenSaved(false);
    setKitchenError('');
  };

  const handleSaveKitchen = async () => {
    setKitchenError('');
    try {
      if (selectedKitchen) {
        await updateKitchen(selectedKitchen.id, kitchenForm);
      } else {
        await createKitchen(kitchenForm);
      }
      setKitchenSaved(true);
      setTimeout(() => setKitchenSaved(false), 2000);
      setShowKitchenForm(false);
      setSelectedKitchen(null);
    } catch (err: any) {
      console.error('Error saving kitchen:', err);
      setKitchenError(err?.response?.data?.message || 'Error al guardar cocina. Verifica que la migración de base de datos se haya ejecutado.');
    }
  };

  const handleDeleteKitchen = async (id: string) => {
    if (confirm('¿Eliminar esta cocina?')) {
      await deleteKitchen(id);
      setShowKitchenForm(false);
      setSelectedKitchen(null);
    }
  };

  // ===== PAYMENT METHOD HANDLERS =====
  const handleCreatePaymentMethod = () => {
    setSelectedPaymentMethod(null);
    setPaymentMethodForm({ name: '', active: true });
    setShowPaymentMethodForm(true);
    setPaymentMethodSaved(false);
    setPaymentMethodError('');
  };

  const handleEditPaymentMethod = (pm: PaymentMethod) => {
    setSelectedPaymentMethod(pm);
    setPaymentMethodForm({ name: pm.name, active: pm.active });
    setShowPaymentMethodForm(true);
    setPaymentMethodSaved(false);
    setPaymentMethodError('');
  };

  const handleSavePaymentMethod = async () => {
    setPaymentMethodError('');
    try {
      if (selectedPaymentMethod) {
        await updatePaymentMethod(selectedPaymentMethod.id, paymentMethodForm);
      } else {
        await createPaymentMethod(paymentMethodForm);
      }
      setPaymentMethodSaved(true);
      setTimeout(() => setPaymentMethodSaved(false), 2000);
      setShowPaymentMethodForm(false);
      setSelectedPaymentMethod(null);
    } catch (err: any) {
      console.error('Error saving payment method:', err);
      setPaymentMethodError(err?.response?.data?.message || 'Error al guardar medio de pago. Verifica que la migración de base de datos se haya ejecutado.');
    }
  };

  const handleDeletePaymentMethod = async (id: string) => {
    if (confirm('¿Eliminar este medio de pago?')) {
      await deletePaymentMethod(id);
      setShowPaymentMethodForm(false);
      setSelectedPaymentMethod(null);
    }
  };

  // ===== SUPPLIER HANDLERS =====
  const handleCreateSupplier = () => {
    setSelectedSupplier(null);
    setSupplierForm({ name: '', phone: '', contactName: '', notes: '', active: true });
    setShowSupplierForm(true);
    setSupplierSaved(false);
    setSupplierError('');
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone || '',
      contactName: supplier.contactName || '',
      notes: supplier.notes || '',
      active: supplier.active,
    });
    setShowSupplierForm(true);
    setSupplierSaved(false);
    setSupplierError('');
  };

  const handleSaveSupplier = async () => {
    setSupplierError('');
    try {
      if (selectedSupplier) {
        await updateSupplier(selectedSupplier.id, supplierForm);
      } else {
        await createSupplier(supplierForm);
      }
      setSupplierSaved(true);
      setTimeout(() => setSupplierSaved(false), 2000);
      setShowSupplierForm(false);
      setSelectedSupplier(null);
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      setSupplierError(err?.response?.data?.message || 'Error al guardar proveedor.');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (confirm('¿Eliminar este proveedor?')) {
      await deleteSupplier(id);
      setShowSupplierForm(false);
      setSelectedSupplier(null);
    }
  };

  // ===== SIDEBAR MENU =====
  const menuItems: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: 'printers', label: 'Impresoras', icon: <PrinterIcon className="w-5 h-5" /> },
    ...(isAdmin ? [{ key: 'users' as Section, label: 'Usuarios', icon: <Users className="w-5 h-5" /> }] : []),
    { key: 'options', label: 'Opciones', icon: <Sliders className="w-5 h-5" /> },
  ];

  // ===== OPTIONS SUB-SECTIONS =====
  const optionsItems: { key: OptionsSubSection; label: string; icon: React.ReactNode; description: string }[] = [
    { key: 'tips', label: 'Propinas', icon: <Percent className="w-5 h-5" />, description: 'Configurar propina sugerida' },
    { key: 'kitchens', label: 'Cocinas', icon: <ChefHat className="w-5 h-5" />, description: 'Destinos de impresión de comandas' },
    { key: 'paymentMethods', label: 'Medios de Pago', icon: <CreditCard className="w-5 h-5" />, description: 'Métodos de pago aceptados' },
    { key: 'suppliers', label: 'Proveedores', icon: <Building2 className="w-5 h-5" />, description: 'Gestión de proveedores de insumos' },
    { key: 'import', label: 'Importación Masiva', icon: <Upload className="w-5 h-5" />, description: 'Importar productos e inventario desde CSV' },
  ];

  // Helper: get right-panel header buttons based on active sub-section
  const renderOptionsHeaderButtons = () => {
    if (optionsSubSection === 'kitchens') {
      return (
        <button
          onClick={handleCreateKitchen}
          className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
        >
          <Plus className="h-4 w-4" />
          <span>Cocina</span>
        </button>
      );
    }
    if (optionsSubSection === 'paymentMethods') {
      return (
        <button
          onClick={handleCreatePaymentMethod}
          className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
        >
          <Plus className="h-4 w-4" />
          <span>Medio de Pago</span>
        </button>
      );
    }
    if (optionsSubSection === 'suppliers') {
      return (
        <button
          onClick={handleCreateSupplier}
          className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
        >
          <Plus className="h-4 w-4" />
          <span>Proveedor</span>
        </button>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full">

      {/* Header — full width, matching Products */}
      <div className="bg-[#555555] text-white px-6 h-[60px] flex items-center justify-between flex-shrink-0">
        <span className="font-bold text-lg tracking-wide">Configuración</span>
        <div className="flex items-center space-x-3">
          {activeSection === 'printers' && (
            <>
              <button
                onClick={() => { setShowPrintSettings(true); setShowPrinterForm(false); }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
              >
                <FileText className="h-4 w-4" />
                <span>Opciones de Impresión</span>
              </button>
              <button
                onClick={handleCreatePrinter}
                className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
              >
                <Plus className="h-4 w-4" />
                <span>Impresora</span>
              </button>
            </>
          )}
          {activeSection === 'users' && (
            <button
              onClick={handleCreateUser}
              className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
            >
              <Plus className="h-4 w-4" />
              <span>Usuario</span>
            </button>
          )}
          {activeSection === 'options' && renderOptionsHeaderButtons()}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className="w-[200px] bg-[#4d4d4d] overflow-y-auto flex-shrink-0">
          <div className="flex flex-col">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveSection(item.key);
                  setShowPrinterForm(false);
                  setShowPrintSettings(false);
                  setShowUserForm(false);
                  setOptionsSubSection(null);
                  setShowKitchenForm(false);
                  setShowPaymentMethodForm(false);
                  setSelectedKitchen(null);
                  setSelectedPaymentMethod(null);
                }}
                className={`w-full text-left px-5 py-4 text-[14px] font-medium transition-colors border-b border-white/5 flex items-center gap-3 ${
                  activeSection === item.key
                    ? 'bg-[#ff5a5f] text-white font-bold'
                    : 'text-gray-200 hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER PANEL */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
          {/* ===== PRINTERS SECTION ===== */}
          {activeSection === 'printers' && (
            <div className="flex-1 overflow-y-auto">
              {/* Print Agent Status + Instructions */}
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-3">🖨️ Cómo funciona la impresión</h3>
                <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-2 text-sm text-gray-600">
                  <p><strong>1.</strong> Ejecuta <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-bold">FerchoPrint.exe</code> en el PC del restaurante (aparece un ícono en la bandeja del sistema).</p>
                  <p><strong>2.</strong> El agente <strong>detecta automáticamente</strong> las impresoras USB (Epson TM-T20II) conectadas al PC.</p>
                  <p><strong>3.</strong> Aquí abajo, agrega las impresoras lógicas y asigna qué cocinas imprime cada una.</p>
                  <p><strong>4.</strong> Al confirmar pedidos, las comandas se envían automáticamente a la impresora correcta.</p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  El ícono verde en la barra superior indica que el Print Agent está conectado
                </div>
              </div>

              {/* Printers list */}
              {printers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <PrinterIcon className="w-16 h-16 text-gray-200 mb-4" />
                  <p className="font-medium">No hay impresoras configuradas</p>
                  <p className="text-sm mt-1">Agrega una impresora para empezar</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Conexión</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Cocinas</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {printers.map((printer) => (
                      <tr
                        key={printer.id}
                        onClick={() => handleEditPrinter(printer)}
                        className={`cursor-pointer transition-colors hover:bg-orange-50/50 ${
                          selectedPrinter?.id === printer.id ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-800">{printer.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{printer.connectionType}</span>
                          {printer.address && <span className="text-xs text-gray-400 ml-2">({printer.address})</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1 flex-wrap">
                            {(printer.kitchens || []).map((k) => (
                              <span key={k} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{k}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${printer.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                            {printer.active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ===== USERS SECTION ===== */}
          {activeSection === 'users' && (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Último Login</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => handleEditUser(user)}
                      className={`cursor-pointer transition-colors hover:bg-orange-50/50 ${
                        selectedUser?.id === user.id ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-800">{user.username}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                          user.role === 'ADMIN' ? 'bg-red-50 text-red-600 border-red-100' :
                          user.role === 'CAJERO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          'bg-green-50 text-green-600 border-green-100'
                        }`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-700 font-medium">{user.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-500 text-sm">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${user.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===== OPTIONS SECTION ===== */}
          {activeSection === 'options' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">
                <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-2">⚙️ Opciones del Sistema</h3>

                {/* 3 cards — always visible */}
                {optionsItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setOptionsSubSection(item.key);
                      setShowKitchenForm(false);
                      setShowPaymentMethodForm(false);
                      setSelectedKitchen(null);
                      setSelectedPaymentMethod(null);
                    }}
                    className={`w-full flex items-center gap-4 p-4 border rounded-xl transition-all group text-left ${
                      optionsSubSection === item.key
                        ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200'
                        : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      optionsSubSection === item.key
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 group-hover:bg-orange-100 text-gray-500 group-hover:text-orange-500'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-sm text-gray-800 block">{item.label}</span>
                      <span className="text-xs text-gray-400">{item.description}</span>
                    </div>
                    <ArrowLeft className={`w-4 h-4 rotate-180 transition-colors ${
                      optionsSubSection === item.key ? 'text-orange-500' : 'text-gray-300 group-hover:text-orange-400'
                    }`} />
                  </button>
                ))}
              </div>

              {/* ===== KITCHENS LIST (below cards when 'kitchens' is selected) ===== */}
              {optionsSubSection === 'kitchens' && (
                <div className="border-t border-gray-200">
                  {kitchens.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <ChefHat className="w-12 h-12 text-gray-200 mb-3" />
                      <p className="font-medium text-sm">No hay cocinas configuradas</p>
                      <p className="text-xs mt-1">Usa el botón "Cocina" arriba para agregar</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {kitchens.map((kitchen) => (
                          <tr
                            key={kitchen.id}
                            onClick={() => handleEditKitchen(kitchen)}
                            className={`cursor-pointer transition-colors hover:bg-orange-50/50 ${
                              selectedKitchen?.id === kitchen.id ? 'bg-yellow-50' : ''
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <ChefHat className="w-4 h-4 text-gray-400" />
                                <span className="font-bold text-gray-800">{kitchen.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${kitchen.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                {kitchen.active ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ===== PAYMENT METHODS LIST (below cards when 'paymentMethods' is selected) ===== */}
              {optionsSubSection === 'paymentMethods' && (
                <div className="border-t border-gray-200">
                  {paymentMethods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <CreditCard className="w-12 h-12 text-gray-200 mb-3" />
                      <p className="font-medium text-sm">No hay medios de pago configurados</p>
                      <p className="text-xs mt-1">Usa el botón "Medio de Pago" arriba para agregar</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paymentMethods.map((pm) => (
                          <tr
                            key={pm.id}
                            onClick={() => handleEditPaymentMethod(pm)}
                            className={`cursor-pointer transition-colors hover:bg-orange-50/50 ${
                              selectedPaymentMethod?.id === pm.id ? 'bg-yellow-50' : ''
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <CreditCard className="w-4 h-4 text-gray-400" />
                                <span className="font-bold text-gray-800">{pm.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${pm.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                {pm.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ===== SUPPLIERS LIST (below cards when 'suppliers' is selected) ===== */}
              {optionsSubSection === 'suppliers' && (
                <div className="border-t border-gray-200">
                  {suppliers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <Building2 className="w-12 h-12 text-gray-200 mb-3" />
                      <p className="font-medium text-sm">No hay proveedores configurados</p>
                      <p className="text-xs mt-1">Usa el botón "Proveedor" arriba para agregar</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Teléfono</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {suppliers.map((sup) => (
                          <tr
                            key={sup.id}
                            onClick={() => handleEditSupplier(sup)}
                            className={`cursor-pointer transition-colors hover:bg-orange-50/50 ${
                              selectedSupplier?.id === sup.id ? 'bg-yellow-50' : ''
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <div>
                                  <span className="font-bold text-gray-800 block">{sup.name}</span>
                                  {sup.contactName && <span className="text-xs text-gray-400">{sup.contactName}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">{sup.phone || '—'}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${sup.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                {sup.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ===== IMPORT SECTION ===== */}
              {optionsSubSection === 'import' && (
                <div className="border-t border-gray-200 p-6 flex flex-col items-center">
                  <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
                    <Upload className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Importar Productos e Inventario</h2>
                    <p className="text-gray-500 mb-6 text-sm">
                      Sube tu archivo CSV (descargado de Google Sheets o Excel).<br/>
                      El sistema actualizará automáticamente los precios o creará los productos nuevos.
                    </p>

                    <div className="bg-orange-50 p-4 rounded-xl text-left mb-6 border border-orange-100">
                      <h4 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Columnas Requeridas en el CSV
                      </h4>
                      <div className="text-xs text-orange-700 font-mono grid grid-cols-2 gap-2">
                        <span>• tipo (POS/OPERACION)</span>
                        <span>• categoría</span>
                        <span>• nombre</span>
                        <span>• precio</span>
                        <span>• costo</span>
                        <span>• unidad</span>
                        <span>• presentacion_cant</span>
                        <span>• presentacion_nombre</span>
                        <span>• stock_ideal</span>
                        <span>• proveedor</span>
                      </div>
                    </div>

                    <label className="relative cursor-pointer bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-orange-500/30 transition-all inline-flex items-center gap-2 overflow-hidden">
                      {importing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Importando datos...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span>Seleccionar Archivo CSV</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".csv"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={importing}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setImporting(true);
                          setImportStats(null);
                          setImportError('');
                          import('papaparse').then((Papa) => {
                            Papa.default.parse(file, {
                              header: true,
                              skipEmptyLines: true,
                              complete: async (results) => {
                                try {
                                  const { api } = await import('../utils/api');
                                  const res = await api.post('/products/import', { rows: results.data });
                                  setImportStats(res.data);
                                } catch (err: any) {
                                  setImportError(err?.response?.data?.error || 'Error al importar');
                                } finally {
                                  setImporting(false);
                                  e.target.value = '';
                                }
                              },
                              error: (err) => {
                                setImportError(err.message);
                                setImporting(false);
                                e.target.value = '';
                              }
                            });
                          });
                        }}
                      />
                    </label>

                    {importError && (
                      <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium flex items-center justify-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {importError}
                      </div>
                    )}

                    {importStats && (
                      <div className="mt-6 p-6 bg-green-50 rounded-xl border border-green-200 text-left">
                        <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          ¡Importación Exitosa!
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                            <span className="block text-2xl font-black text-green-600">{importStats.created}</span>
                            <span className="text-xs font-bold text-gray-500 uppercase">Productos procesados</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                            <span className="block text-2xl font-black text-orange-500">{importStats.skipped}</span>
                            <span className="text-xs font-bold text-gray-500 uppercase">Filas omitidas</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                            <span className="block text-2xl font-black text-blue-600">{importStats.categories}</span>
                            <span className="text-xs font-bold text-gray-500 uppercase">Categorías</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                            <span className="block text-2xl font-black text-purple-600">{importStats.suppliers}</span>
                            <span className="text-xs font-bold text-gray-500 uppercase">Proveedores</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      {/* RIGHT PANEL / DRAWER */}
      <div className="w-[480px] bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
        
        {/* ===== PRINTER FORM ===== */}
        {activeSection === 'printers' && showPrinterForm && (
          <>
            <div className="bg-[#555555] text-white p-5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-sm uppercase tracking-wider">
                {selectedPrinter ? 'Editar Impresora' : 'Nueva Impresora'}
              </h2>
              <div className="flex gap-2">
                {selectedPrinter && (
                  <button onClick={() => handleDeletePrinter(selectedPrinter.id)} className="p-2 hover:bg-white/20 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setShowPrinterForm(false); setSelectedPrinter(null); }} className="p-2 hover:bg-white/20 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre *</label>
                <input
                  type="text" value={printerForm.name}
                  onChange={e => setPrinterForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  placeholder="Ej: Impresora Cocina"
                />
              </div>
              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>💡 Nota:</strong> Las impresoras USB se detectan automáticamente cuando el Print Agent (FerchoPrint.exe) está corriendo en el PC. Solo necesitas definir el nombre y las cocinas asignadas.
              </div>
              {/* Kitchens — now dynamic */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cocinas que imprime</label>
                <div className="flex flex-wrap gap-2">
                  {kitchenOptions.map(kitchen => (
                    <button
                      key={kitchen}
                      onClick={() => toggleKitchen(kitchen)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
                        printerForm.kitchens.includes(kitchen)
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      {kitchen}
                    </button>
                  ))}
                  {kitchenOptions.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No hay cocinas configuradas. Agrégalas en Opciones → Cocinas.</p>
                  )}
                </div>
              </div>
              {/* Print Commands Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Imprime Comandas</span>
                  <span className="text-xs text-gray-400">Enviar tickets de comanda a esta impresora</span>
                </div>
                <button onClick={() => setPrinterForm(p => ({ ...p, printCommands: !p.printCommands }))}>
                  {printerForm.printCommands
                    ? <ToggleRight className="w-8 h-8 text-orange-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              {/* Print Invoice Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Imprime Facturas</span>
                  <span className="text-xs text-gray-400">Enviar factura de cierre de mesa a esta impresora</span>
                </div>
                <button onClick={() => setPrinterForm(p => ({ ...p, printInvoice: !p.printInvoice }))}>
                  {printerForm.printInvoice
                    ? <ToggleRight className="w-8 h-8 text-orange-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              {/* Active Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Activa</span>
                  <span className="text-xs text-gray-400">Deshabilitar temporalmente sin eliminar</span>
                </div>
                <button onClick={() => setPrinterForm(p => ({ ...p, active: !p.active }))}>
                  {printerForm.active
                    ? <ToggleRight className="w-8 h-8 text-green-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSavePrinter}
                disabled={!printerForm.name.trim()}
                className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar Impresora
              </button>
            </div>
          </>
        )}

        {/* ===== PRINT SETTINGS PANEL ===== */}
        {activeSection === 'printers' && showPrintSettings && (
          <>
            <div className="bg-[#555555] text-white p-5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Opciones de Impresión
              </h2>
              <button onClick={() => setShowPrintSettings(false)} className="p-2 hover:bg-gray-600 rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Encabezado de factura</label>
                <textarea
                  value={headerText}
                  onChange={e => setHeaderText(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono resize-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  rows={5}
                />
              </div>
              {/* Footer */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pie de página de factura</label>
                <textarea
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono resize-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  rows={10}
                />
              </div>

              {/* QR CODE SECTION */}
              <div className="border-t border-gray-200 pt-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  Código QR de pago en factura
                </label>

                {/* QR Preview or Upload */}
                {qrImage ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                      <img
                        src={qrImage}
                        alt="QR de pago"
                        className="w-40 h-40 object-contain rounded-xl border-2 border-gray-200 bg-white p-2 shadow-sm"
                      />
                      <button
                        onClick={() => setQrImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar QR"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <label className="text-xs text-orange-500 font-bold cursor-pointer hover:underline flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      Cambiar imagen
                      <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group">
                    <Upload className="w-8 h-8 text-gray-300 group-hover:text-orange-400 mb-2 transition" />
                    <span className="text-sm font-bold text-gray-400 group-hover:text-orange-500 transition">Subir imagen QR</span>
                    <span className="text-xs text-gray-300 mt-1">PNG, JPG o SVG</span>
                    <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
                  </label>
                )}

                {/* QR Text */}
                <div className="mt-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Texto debajo del QR</label>
                  <textarea
                    value={qrText}
                    onChange={e => setQrText(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                    rows={3}
                    placeholder="Ej: Escanea para pagar..."
                  />
                </div>
              </div>

              {/* Save */}
              <button
                onClick={handleSaveSettings}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                {settingsSaved ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
                {settingsSaved ? '¡Guardado!' : 'Guardar Configuración'}
              </button>
            </div>
          </>
        )}

        {/* ===== EMPTY STATE PRINTERS ===== */}
        {activeSection === 'printers' && !showPrinterForm && !showPrintSettings && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
            <Edit3 className="w-12 h-12 mb-4" />
            <p className="font-medium text-gray-400 text-center">Selecciona una impresora para editarla o crea una nueva</p>
          </div>
        )}

        {/* ===== USER FORM ===== */}
        {activeSection === 'users' && showUserForm && (
          <>
            <div className="bg-[#555555] text-white p-5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-sm uppercase tracking-wider">
                {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <div className="flex gap-2">
                {selectedUser && (
                  <button onClick={() => handleDeleteUser(selectedUser.id)} className="p-2 hover:bg-white/20 rounded-lg transition" title="Desactivar usuario">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setShowUserForm(false); setSelectedUser(null); }} className="p-2 hover:bg-white/20 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {userError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {userError}
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Usuario *</label>
                <input
                  type="text" value={userForm.username}
                  onChange={e => setUserForm(p => ({ ...p, username: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  placeholder="Ej: federico"
                />
              </div>
              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Contraseña {selectedUser ? '(dejar vacía para no cambiar)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} value={userForm.password}
                    onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Confirm Password */}
              {userForm.password && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Confirmar Contraseña *</label>
                  <input
                    type={showPassword ? 'text' : 'password'} value={userForm.confirmPassword}
                    onChange={e => setUserForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition ${
                      userForm.confirmPassword && userForm.password !== userForm.confirmPassword
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-gray-200'
                    }`}
                    placeholder="••••••••"
                  />
                </div>
              )}
              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Rol *</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm(p => ({ ...p, role: e.target.value as any }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition bg-white"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="CAJERO">Cajero</option>
                  <option value="MESERO">Mesero</option>
                </select>
                <p className="text-xs text-gray-400 mt-1.5">
                  {userForm.role === 'ADMIN' && 'Acceso total al sistema, incluyendo gestión de usuarios'}
                  {userForm.role === 'CAJERO' && 'Igual que Admin pero sin gestionar usuarios'}
                  {userForm.role === 'MESERO' && 'Solo puede abrir mesas, agregar productos e imprimir facturas'}
                </p>
              </div>
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre *</label>
                <input
                  type="text" value={userForm.name}
                  onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  placeholder="Ej: Federico López"
                />
              </div>
              {/* Active Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Activo</span>
                  <span className="text-xs text-gray-400">Desactivar si ya no trabaja en el establecimiento</span>
                </div>
                <button onClick={() => setUserForm(p => ({ ...p, active: !p.active }))}>
                  {userForm.active
                    ? <ToggleRight className="w-8 h-8 text-green-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowUserForm(false); setSelectedUser(null); }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl transition hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveUser}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===== EMPTY STATE USERS ===== */}
        {activeSection === 'users' && !showUserForm && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
            <Users className="w-12 h-12 mb-4" />
            <p className="font-medium text-gray-400 text-center">Selecciona un usuario para editarlo o crea uno nuevo</p>
          </div>
        )}

        {/* ===== KITCHEN FORM (Right Panel) ===== */}
        {activeSection === 'options' && optionsSubSection === 'kitchens' && showKitchenForm && (
          <>
            <div className="bg-[#555555] text-white p-5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-sm uppercase tracking-wider">
                {selectedKitchen ? 'Editar Cocina' : 'Nueva Cocina'}
              </h2>
              <div className="flex gap-2">
                {selectedKitchen && (
                  <button onClick={() => handleDeleteKitchen(selectedKitchen.id)} className="p-2 hover:bg-white/20 rounded-lg transition" title="Eliminar cocina">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setShowKitchenForm(false); setSelectedKitchen(null); }} className="p-2 hover:bg-white/20 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {kitchenError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {kitchenError}
                </div>
              )}
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre *</label>
                <input
                  type="text" value={kitchenForm.name}
                  onChange={e => setKitchenForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  placeholder="Ej: Barra, Cocina, Tienda..."
                />
              </div>
              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>💡 Nota:</strong> Las cocinas definen los destinos de impresión. Al asignar una cocina a una impresora, las comandas de productos de esa cocina se enviarán a la impresora correspondiente.
              </div>
              {/* Active Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Activa</span>
                  <span className="text-xs text-gray-400">Deshabilitar temporalmente sin eliminar</span>
                </div>
                <button onClick={() => setKitchenForm(p => ({ ...p, active: !p.active }))}>
                  {kitchenForm.active
                    ? <ToggleRight className="w-8 h-8 text-green-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              {/* Save */}
              <button
                onClick={handleSaveKitchen}
                disabled={!kitchenForm.name.trim()}
                className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {kitchenSaved ? <CheckCircle2 className="w-4 h-4 text-green-200" /> : <Save className="w-4 h-4" />}
                {kitchenSaved ? '¡Guardado!' : 'Guardar Cocina'}
              </button>
            </div>
          </>
        )}

        {/* ===== PAYMENT METHOD FORM (Right Panel) ===== */}
        {activeSection === 'options' && optionsSubSection === 'paymentMethods' && showPaymentMethodForm && (
          <>
            <div className="bg-[#555555] text-white p-5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-sm uppercase tracking-wider">
                {selectedPaymentMethod ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago'}
              </h2>
              <div className="flex gap-2">
                {selectedPaymentMethod && (
                  <button onClick={() => handleDeletePaymentMethod(selectedPaymentMethod.id)} className="p-2 hover:bg-white/20 rounded-lg transition" title="Eliminar medio de pago">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setShowPaymentMethodForm(false); setSelectedPaymentMethod(null); }} className="p-2 hover:bg-white/20 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {paymentMethodError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {paymentMethodError}
                </div>
              )}
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre *</label>
                <input
                  type="text" value={paymentMethodForm.name}
                  onChange={e => setPaymentMethodForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  placeholder="Ej: Efectivo, QR, Bold..."
                />
              </div>
              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>💡 Nota:</strong> Los medios de pago aparecerán como opciones al cerrar una mesa. Si desactivas un medio, no estará disponible para nuevos pagos.
              </div>
              {/* Active Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Activo</span>
                  <span className="text-xs text-gray-400">Deshabilitar temporalmente sin eliminar</span>
                </div>
                <button onClick={() => setPaymentMethodForm(p => ({ ...p, active: !p.active }))}>
                  {paymentMethodForm.active
                    ? <ToggleRight className="w-8 h-8 text-green-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              {/* Save */}
              <button
                onClick={handleSavePaymentMethod}
                disabled={!paymentMethodForm.name.trim()}
                className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {paymentMethodSaved ? <CheckCircle2 className="w-4 h-4 text-green-200" /> : <Save className="w-4 h-4" />}
                {paymentMethodSaved ? '¡Guardado!' : 'Guardar Medio de Pago'}
              </button>
            </div>
          </>
        )}

        {/* ===== EMPTY STATE: KITCHENS ===== */}
        {activeSection === 'options' && optionsSubSection === 'kitchens' && !showKitchenForm && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
            <ChefHat className="w-12 h-12 mb-4" />
            <p className="font-medium text-gray-400 text-center">Selecciona una cocina para editarla o crea una nueva</p>
          </div>
        )}

        {/* ===== EMPTY STATE: PAYMENT METHODS ===== */}
        {activeSection === 'options' && optionsSubSection === 'paymentMethods' && !showPaymentMethodForm && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
            <CreditCard className="w-12 h-12 mb-4" />
            <p className="font-medium text-gray-400 text-center">Selecciona un medio de pago para editarlo o crea uno nuevo</p>
          </div>
        )}

        {/* ===== SUPPLIER FORM (Right Panel) ===== */}
        {activeSection === 'options' && optionsSubSection === 'suppliers' && showSupplierForm && (
          <>
            <div className="bg-[#555555] text-white p-5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-sm uppercase tracking-wider">
                {selectedSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <div className="flex gap-2">
                {selectedSupplier && (
                  <button onClick={() => handleDeleteSupplier(selectedSupplier.id)} className="p-2 hover:bg-white/20 rounded-lg transition" title="Eliminar proveedor">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setShowSupplierForm(false); setSelectedSupplier(null); }} className="p-2 hover:bg-white/20 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {supplierError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {supplierError}
                </div>
              )}
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre *</label>
                <input
                  type="text" value={supplierForm.name}
                  onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  placeholder="Ej: Distribuidora Licores, Éxito..."
                />
              </div>
              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Teléfono / WhatsApp</label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <input
                    type="text" value={supplierForm.phone}
                    onChange={e => setSupplierForm(p => ({ ...p, phone: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                    placeholder="Ej: 3001234567"
                  />
                </div>
              </div>
              {/* Contact Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Persona de contacto</label>
                <input
                  type="text" value={supplierForm.contactName}
                  onChange={e => setSupplierForm(p => ({ ...p, contactName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                  placeholder="Nombre del contacto (opcional)"
                />
              </div>
              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notas</label>
                <textarea
                  value={supplierForm.notes}
                  onChange={e => setSupplierForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition resize-none"
                  rows={3}
                  placeholder="Notas adicionales sobre el proveedor..."
                />
              </div>
              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>💡 Nota:</strong> Los proveedores se asignan a productos para generar pedidos automáticos agrupados por proveedor, con mensaje de WhatsApp y total estimado.
              </div>
              {/* Active Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Activo</span>
                  <span className="text-xs text-gray-400">Deshabilitar temporalmente sin eliminar</span>
                </div>
                <button onClick={() => setSupplierForm(p => ({ ...p, active: !p.active }))}>
                  {supplierForm.active
                    ? <ToggleRight className="w-8 h-8 text-green-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              {/* Save */}
              <button
                onClick={handleSaveSupplier}
                disabled={!supplierForm.name.trim()}
                className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {supplierSaved ? <CheckCircle2 className="w-4 h-4 text-green-200" /> : <Save className="w-4 h-4" />}
                {supplierSaved ? '¡Guardado!' : 'Guardar Proveedor'}
              </button>
            </div>
          </>
        )}

        {/* ===== EMPTY STATE: SUPPLIERS ===== */}
        {activeSection === 'options' && optionsSubSection === 'suppliers' && !showSupplierForm && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
            <Building2 className="w-12 h-12 mb-4" />
            <p className="font-medium text-gray-400 text-center">Selecciona un proveedor para editarlo o crea uno nuevo</p>
          </div>
        )}

        {/* ===== EMPTY STATE: OPTIONS (main menu only) ===== */}
        {activeSection === 'options' && optionsSubSection === null && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
            <Sliders className="w-12 h-12 mb-4" />
            <p className="font-medium text-gray-400 text-center">Configura las opciones generales del sistema</p>
          </div>
        )}

        {/* ===== TIPS FORM (Right Panel) ===== */}
        {activeSection === 'options' && optionsSubSection === 'tips' && (
          <>
            <div className="bg-[#555555] text-white p-5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-sm uppercase tracking-wider">💰 Configuración de Propinas</h2>
              <button onClick={() => setOptionsSubSection(null)} className="p-2 hover:bg-white/20 rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-gray-700 block">Propinas habilitadas</span>
                  <span className="text-xs text-gray-400">Sugerir propina voluntaria al cerrar mesas</span>
                </div>
                <button onClick={() => setTipEnabled(!tipEnabled)}>
                  {tipEnabled
                    ? <ToggleRight className="w-8 h-8 text-green-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>

              {tipEnabled && (
                <>
                  {/* Threshold */}
                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tope mínimo para propina</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-bold">$</span>
                      <input
                        type="text"
                        value={parseInt(tipThreshold || '0').toLocaleString('es-CO')}
                        onChange={(e) => setTipThreshold(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                        placeholder="150000"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Solo se sugiere propina en ventas iguales o superiores a este monto</p>
                  </div>

                  {/* Percentage */}
                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Porcentaje de propina</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={tipPercent}
                        onChange={(e) => setTipPercent(e.target.value)}
                        min="1"
                        max="100"
                        className="w-20 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold text-center focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                      />
                      <span className="text-gray-500 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Porcentaje que se sugiere sobre el subtotal de la venta</p>
                  </div>
                </>
              )}

              {/* Save Button */}
              <button
                onClick={async () => {
                  await updateAppSettings({
                    tipEnabled,
                    tipThreshold: parseInt(tipThreshold) || 150000,
                    tipPercent: parseInt(tipPercent) || 10,
                  });
                  setOptionsSaved(true);
                  setTimeout(() => setOptionsSaved(false), 2000);
                }}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                {optionsSaved ? <CheckCircle2 className="w-4 h-4 text-green-200" /> : <Save className="w-4 h-4" />}
                {optionsSaved ? '¡Guardado!' : 'Guardar Opciones'}
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default Config;
