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
  QrCode
} from 'lucide-react';
import { useConfigStore, type Printer, type UserItem } from '../store/configStore';

type Section = 'printers' | 'users';

const KITCHENS_OPTIONS = ['Barra', 'Cocina', 'Tienda', 'Cabalgatas'];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  MESERO: 'Mesero',
};

const Config: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('printers');

  // ===== PRINTERS STATE =====
  const {
    printers, fetchPrinters, createPrinter, updatePrinter, deletePrinter,
    printSettings, fetchPrintSettings, updatePrintSettings,
    users, fetchUsers, createUser, updateUser, deleteUser,
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

  useEffect(() => {
    fetchPrinters();
    fetchPrintSettings();
    fetchUsers();
  }, [fetchPrinters, fetchPrintSettings, fetchUsers]);

  useEffect(() => {
    if (printSettings) {
      setHeaderText(printSettings.header);
      setFooterText(printSettings.footer);
      setQrImage(printSettings.qrImage);
      setQrText(printSettings.qrText || 'Si deseas pagar desde cualquier banco o billetera virtual, usa este QR');
    }
  }, [printSettings]);

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
      printInvoice: (printer as any).printInvoice || false,
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

  // ===== SIDEBAR MENU =====
  const menuItems: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: 'printers', label: 'Impresoras', icon: <PrinterIcon className="w-5 h-5" /> },
    { key: 'users', label: 'Usuarios', icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="flex flex-col h-full w-full">

      {/* Header — full width, matching Products */}
      <div className="bg-[#555555] text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
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
        </div>

      {/* RIGHT PANEL / DRAWER */}
      <div className="w-[400px] bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
        
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
              {/* Kitchens */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cocinas que imprime</label>
                <div className="flex flex-wrap gap-2">
                  {KITCHENS_OPTIONS.map(kitchen => (
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
            <div className="bg-gray-700 text-white p-5 flex items-center justify-between shrink-0">
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
                className="w-full py-3 bg-gray-700 hover:bg-gray-800 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
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
                  {userForm.role === 'ADMIN' && 'Acceso total al sistema incluyendo configuración'}
                  {userForm.role === 'CAJERO' && 'Puede cerrar mesas y gestionar caja. No puede eliminar productos de mesas.'}
                  {userForm.role === 'MESERO' && 'Puede abrir mesas, agregar productos e imprimir. No puede cerrar mesas.'}
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
      </div>
      </div>
    </div>
  );
};

export default Config;
