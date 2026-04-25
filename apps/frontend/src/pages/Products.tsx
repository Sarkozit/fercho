import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import { Star, ArrowLeft, Plus, Search, Pencil, Trash2, X, AlertTriangle, Upload, ImageIcon } from 'lucide-react';
import Papa from 'papaparse';
import { useRef } from 'react';
import { useConfigStore } from '../store/configStore';

// Build full image URL from relative path stored in DB
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
const getImageUrl = (relativePath: string | null) => relativePath ? `${API_BASE}${relativePath}` : '';

interface Category {
  id: string;
  name: string;
  onlineMenu: boolean;
  imageUrl: string | null;
  sortOrder: number;
  products: Product[];
}

interface Product {
  id: string;
  code: string | null;
  name: string;
  cost: number;
  price: number;
  favorite: boolean;
  active: boolean;
  onlineMenu: boolean;
  excludeFromReports: boolean;
  imageUrl: string | null;
  kitchen: string;
  categoryId: string;
  supplierId: string | null;
  idealStock: number;
  unit: string;
  packSize: number;
  packName: string;
  category: Category;
}

type PanelView =
  | 'products'
  | 'product_detail'
  | 'new_product'
  | 'new_category'
  | 'edit_category';

interface DeleteCategoryModal {
  category: Category;
}

// ── Shared field styles ───────────────────────────────────────────────────────
const labelCls = 'w-36 text-sm font-semibold text-gray-600 flex-shrink-0';
const inputCls =
  'flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 focus:border-orange-400 outline-none transition';
const checkboxCls =
  'w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-400 cursor-pointer accent-orange-500';

// ── Helpers — defined OUTSIDE the component to keep stable references ─────────
function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3">{children}</div>;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-bold text-gray-800">{title}</h3>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

const Products: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const categoryImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Suppliers from config store
  const { suppliers, fetchSuppliers } = useConfigStore();

  // Panel view state
  const [view, setView] = useState<PanelView>('products');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Delete category modal
  const [deleteModal, setDeleteModal] = useState<DeleteCategoryModal | null>(null);
  const [deleteAction, setDeleteAction] = useState<'delete_products' | 'migrate_products'>('delete_products');
  const [migrateToCategoryId, setMigrateToCategoryId] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Delete product modal
  const [deleteProductModal, setDeleteProductModal] = useState<Product | null>(null);
  const [deleteProductLoading, setDeleteProductLoading] = useState(false);

  // New product form
  const [newProduct, setNewProduct] = useState({
    name: '',
    categoryId: '',
    price: '',
    code: '',
    kitchen: 'Cocina',
    active: true,
    onlineMenu: true,
    favorite: false,
  });
  const [newProductError, setNewProductError] = useState('');
  const [newProductLoading, setNewProductLoading] = useState(false);

  // New / edit category form
  const [categoryForm, setCategoryForm] = useState({ name: '', onlineMenu: true });
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFormLoading, setCategoryFormLoading] = useState(false);

  // Edit category – track name/online in place
  const [editCategoryDraft, setEditCategoryDraft] = useState({ name: '', onlineMenu: true });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchCategories = async () => {
    try {
      const res = await axios.get('/products/categories');
      setCategories(res.data);
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  };

  const fetchProducts = async (categoryId?: string | null, search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      else if (categoryId) params.append('categoryId', categoryId);
      const res = await axios.get('/products' + (params.toString() ? `?${params}` : ''));
      setProducts(res.data);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); fetchSuppliers(); }, []);

  useEffect(() => {
    if (searchQuery) {
      const t = setTimeout(() => fetchProducts(null, searchQuery), 500);
      return () => clearTimeout(t);
    } else {
      fetchProducts(selectedCategoryId);
    }
  }, [selectedCategoryId, searchQuery]);

  // ── Product helpers ───────────────────────────────────────────────────────
  const toggleFavorite = async (product: Product) => {
    try {
      const res = await axios.put(`/products/${product.id}`, { favorite: !product.favorite });
      setProducts(prev => prev.map(p => p.id === product.id ? res.data : p));
      if (selectedProduct?.id === product.id) setSelectedProduct(res.data);
    } catch (e) {
      console.error('Error toggling favorite:', e);
    }
  };

  const updateProductField = async (productId: string, field: string, value: any) => {
    try {
      const res = await axios.put(`/products/${productId}`, { [field]: value });
      setProducts(prev => prev.map(p => p.id === productId ? res.data : p));
      setSelectedProduct(res.data);
    } catch (e) {
      console.error('Error updating product:', e);
    }
  };

  const uploadProductImage = async (productId: string, file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`/products/${productId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProducts(prev => prev.map(p => p.id === productId ? res.data : p));
      setSelectedProduct(res.data);
    } catch (e) {
      console.error('Error uploading image:', e);
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteProductImage = async (productId: string) => {
    try {
      const res = await axios.delete(`/products/${productId}/image`);
      setProducts(prev => prev.map(p => p.id === productId ? res.data : p));
      setSelectedProduct(res.data);
    } catch (e) {
      console.error('Error deleting image:', e);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProductModal) return;
    setDeleteProductLoading(true);
    try {
      await axios.delete(`/products/${deleteProductModal.id}`);
      setProducts(prev => prev.filter(p => p.id !== deleteProductModal.id));
      setDeleteProductModal(null);
      setSelectedProduct(null);
      setView('products');
      await fetchCategories();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al eliminar el producto.');
    } finally {
      setDeleteProductLoading(false);
    }
  };

  const uploadCategoryImage = async (categoryId: string, file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`/products/categories/${categoryId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditingCategory(res.data);
      await fetchCategories();
    } catch (e) {
      console.error('Error uploading category image:', e);
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteCategoryImage = async (categoryId: string) => {
    try {
      await axios.put(`/products/categories/${categoryId}`, { imageUrl: null });
      if (editingCategory) setEditingCategory({ ...editingCategory, imageUrl: null });
      await fetchCategories();
    } catch (e) {
      console.error('Error deleting category image:', e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map((row: any) => {
          return {
            code: row[0],
            category: row[1],
            name: row[2],
            price: row[3],
            active: row[4],
            favorite: row[5],
            onlineMenu: row[6],
            kitchen: row[7]
          };
        });

        // Filtrar fila de encabezados si existe
        const dataRows = rows.filter(r => 
          r.name && 
          r.name.toLowerCase() !== 'nombre' && 
          r.name.toLowerCase() !== 'nombre del producto'
        );

        if (dataRows.length === 0) {
          alert('El archivo no tiene productos válidos.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        try {
          setLoading(true);
          const res = await axios.post('/products/import', { rows: dataRows });
          await fetchCategories();
          await fetchProducts(selectedCategoryId);
          alert(`¡Importación exitosa! Productos creados: ${res.data.created}. Omitidos/Erróneos: ${res.data.skipped}.`);
          setImportModalOpen(false);
        } catch (err: any) {
          console.error('Error importing CSV:', err);
          alert(err.response?.data?.error || 'Error al importar los productos');
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        alert('Error al leer el archivo CSV: ' + error.message);
      }
    });
  };

  // ── Create product ─────────────────────────────────────────────────────────
  const openNewProduct = () => {
    setNewProduct({ name: '', categoryId: categories[0]?.id || '', price: '', code: '', kitchen: 'Cocina', active: true, onlineMenu: true, favorite: false });
    setNewProductError('');
    setView('new_product');
  };

  const submitNewProduct = async () => {
    if (!newProduct.name.trim()) { setNewProductError('El nombre es requerido.'); return; }
    if (!newProduct.categoryId) { setNewProductError('Selecciona una categoría.'); return; }
    if (!newProduct.price || isNaN(parseFloat(newProduct.price))) { setNewProductError('El precio es requerido.'); return; }
    setNewProductLoading(true);
    setNewProductError('');
    try {
      await axios.post('/products', {
        name: newProduct.name.trim(),
        categoryId: newProduct.categoryId,
        price: parseFloat(newProduct.price),
        cost: (newProduct as any).cost ? parseFloat((newProduct as any).cost) : 0,
        code: newProduct.code.trim() || undefined,
        kitchen: newProduct.kitchen.trim() || 'Cocina',
        active: newProduct.active,
        onlineMenu: newProduct.onlineMenu,
        favorite: newProduct.favorite,
        supplierId: (newProduct as any).supplierId || undefined,
      });
      await fetchProducts(selectedCategoryId);
      setView('products');
    } catch (e: any) {
      setNewProductError(e.response?.data?.error || 'Error al crear el producto.');
    } finally {
      setNewProductLoading(false);
    }
  };

  // ── Create category ────────────────────────────────────────────────────────
  const openNewCategory = () => {
    setCategoryForm({ name: '', onlineMenu: true });
    setCategoryFormError('');
    setView('new_category');
  };

  const submitNewCategory = async () => {
    if (!categoryForm.name.trim()) { setCategoryFormError('El nombre es requerido.'); return; }
    setCategoryFormLoading(true);
    setCategoryFormError('');
    try {
      await axios.post('/products/categories', { name: categoryForm.name.trim(), onlineMenu: categoryForm.onlineMenu });
      await fetchCategories();
      setView('products');
    } catch (e: any) {
      setCategoryFormError(e.response?.data?.error || 'Error al crear la categoría.');
    } finally {
      setCategoryFormLoading(false);
    }
  };

  // ── Edit category ──────────────────────────────────────────────────────────
  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCategoryDraft({ name: cat.name, onlineMenu: cat.onlineMenu });
    setCategoryFormError('');
    setView('edit_category');
  };

  const submitEditCategory = async () => {
    if (!editCategoryDraft.name.trim()) { setCategoryFormError('El nombre es requerido.'); return; }
    if (!editingCategory) return;
    setCategoryFormLoading(true);
    setCategoryFormError('');
    try {
      await axios.put(`/products/categories/${editingCategory.id}`, {
        name: editCategoryDraft.name.trim(),
        onlineMenu: editCategoryDraft.onlineMenu,
      });
      await fetchCategories();
      setView('products');
      setEditingCategory(null);
    } catch (e: any) {
      setCategoryFormError(e.response?.data?.error || 'Error al actualizar la categoría.');
    } finally {
      setCategoryFormLoading(false);
    }
  };

  // ── Delete category ────────────────────────────────────────────────────────
  const openDeleteModal = (cat: Category) => {
    setDeleteModal({ category: cat });
    setDeleteAction('delete_products');
    // Default migrate target: first category that is NOT the one being deleted
    const other = categories.find(c => c.id !== cat.id);
    setMigrateToCategoryId(other?.id || '');
  };

  const confirmDeleteCategory = async () => {
    if (!deleteModal) return;
    if (deleteAction === 'migrate_products' && !migrateToCategoryId) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`/products/categories/${deleteModal.category.id}`, {
        data: { action: deleteAction, targetCategoryId: deleteAction === 'migrate_products' ? migrateToCategoryId : undefined }
      });
      await fetchCategories();
      await fetchProducts(selectedCategoryId);
      // Reset selected category if we deleted it
      if (selectedCategoryId === deleteModal.category.id) setSelectedCategoryId(null);
      setDeleteModal(null);
      if (view === 'edit_category') setView('products');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al eliminar la categoría.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const goBack = () => {
    setView('products');
    setSelectedProduct(null);
    setEditingCategory(null);
  };

  const otherCategories = deleteModal
    ? categories.filter(c => c.id !== deleteModal.category.id)
    : [];

  // ── Shared panel header — kept as inline arrow fn is fine (no children, no remount risk)
  const PanelBackHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm font-medium">Volver</span>
      </button>
      <span className="text-gray-300">|</span>
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full">

      {/* Header */}
      <div className="bg-[#555555] text-white px-6 py-3 min-h-[52px] flex items-center justify-between flex-shrink-0">
        <span className="font-bold text-lg tracking-wide">Productos</span>
        <div className="flex items-center space-x-3">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
          >
            <Upload className="h-4 w-4" />
            <span>Importar CSV</span>
          </button>
          <button
            onClick={openNewCategory}
            className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
          >
            <Plus className="h-4 w-4" />
            <span>Categoría</span>
          </button>
          <button
            onClick={openNewProduct}
            className="flex items-center space-x-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
          >
            <Plus className="h-4 w-4" />
            <span>Producto</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Categories sidebar ──────────────────────────────────────────── */}
        <div className="w-[200px] bg-[#4d4d4d] overflow-y-auto flex-shrink-0">
          <div className="flex flex-col">
            <button
              onClick={() => { setSelectedCategoryId(null); setView('products'); }}
              className={`w-full text-left px-5 py-4 text-[14px] font-medium transition-colors border-b border-white/5 ${selectedCategoryId === null ? 'bg-[#ff5a5f] text-white font-bold' : 'text-gray-200 hover:bg-white/5'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <div key={cat.id} className="relative group">
                <button
                  onClick={() => { setSelectedCategoryId(cat.id); setView('products'); }}
                  className={`w-full text-left px-5 py-4 pr-16 text-[14px] font-medium transition-colors border-b border-white/5 ${cat.id === selectedCategoryId ? 'bg-[#ff5a5f] text-white font-bold' : 'text-gray-200 hover:bg-white/5'}`}
                >
                  {cat.name}
                </button>
                {/* Edit / Delete icons */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                    title="Editar categoría"
                    className="p-1.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDeleteModal(cat); }}
                    title="Eliminar categoría"
                    className="p-1.5 rounded hover:bg-red-500/40 text-white/70 hover:text-red-200 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">

          {/* ── PRODUCT DETAIL ── */}
          {view === 'product_detail' && selectedProduct && (
            <div className="p-6">
              <PanelBackHeader title={`Producto: ${selectedProduct.name}`} />
              <DetailCard title="Detalles">
                <FormRow>
                  <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                  <input className={inputCls} value={selectedProduct.name}
                    onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                    onBlur={() => updateProductField(selectedProduct.id, 'name', selectedProduct.name)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Categoría <span className="text-red-500">*</span></label>
                  <select className={inputCls} value={selectedProduct.categoryId}
                    onChange={e => updateProductField(selectedProduct.id, 'categoryId', e.target.value)}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Precio <span className="text-red-500">*</span></label>
                  <input type="number" className={inputCls} value={selectedProduct.price}
                    onChange={e => setSelectedProduct({ ...selectedProduct, price: parseFloat(e.target.value) || 0 })}
                    onBlur={() => updateProductField(selectedProduct.id, 'price', selectedProduct.price)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Costo</label>
                  <input type="number" className={inputCls} value={selectedProduct.cost}
                    onChange={e => setSelectedProduct({ ...selectedProduct, cost: parseFloat(e.target.value) || 0 })}
                    onBlur={() => updateProductField(selectedProduct.id, 'cost', selectedProduct.cost)} />
                </FormRow>
                {selectedProduct.price > 0 && selectedProduct.cost > 0 && (
                  <FormRow>
                    <label className={labelCls}>Utilidad</label>
                    <span className="text-sm font-bold text-green-600">
                      ${(selectedProduct.price - selectedProduct.cost).toLocaleString('es-CO')} ({Math.round(((selectedProduct.price - selectedProduct.cost) / selectedProduct.price) * 100)}%)
                    </span>
                  </FormRow>
                )}
                <FormRow>
                  <label className={labelCls}>Proveedor</label>
                  <select className={inputCls} value={selectedProduct.supplierId || ''}
                    onChange={e => updateProductField(selectedProduct.id, 'supplierId', e.target.value || null)}>
                    <option value="">— Sin proveedor —</option>
                    {suppliers.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Stock Ideal</label>
                  <input type="number" min="0" className={inputCls} value={selectedProduct.idealStock}
                    onChange={e => setSelectedProduct({ ...selectedProduct, idealStock: parseInt(e.target.value) || 0 })}
                    onBlur={() => updateProductField(selectedProduct.id, 'idealStock', selectedProduct.idealStock)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Unidad</label>
                  <div className="flex-1 w-full">
                    <select className={inputCls.replace('flex-1', 'w-full')} value={selectedProduct.unit}
                      onChange={e => updateProductField(selectedProduct.id, 'unit', e.target.value)}>
                      <option value="und">Unidad</option>
                      <option value="botella">Botella</option>
                      <option value="media">Media</option>
                      <option value="porcion">Porción</option>
                      <option value="kg">Kilogramo</option>
                      <option value="libra">Libra</option>
                      <option value="litro">Litro</option>
                      <option value="paquete">Paquete</option>
                      <option value="caja">Caja</option>
                      <option value="bolsa">Bolsa</option>
                    </select>
                    <span className="text-[10px] text-gray-400 block mt-1 leading-tight">Medida para el conteo (Ej: Botella, Porción).</span>
                  </div>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Presentación (cant.)</label>
                  <div className="flex-1 w-full">
                    <input type="number" min="1" className={inputCls.replace('flex-1', 'w-full')} value={selectedProduct.packSize}
                      onChange={e => setSelectedProduct({ ...selectedProduct, packSize: parseInt(e.target.value) || 1 })}
                      onBlur={() => updateProductField(selectedProduct.id, 'packSize', selectedProduct.packSize)} />
                    <span className="text-[10px] text-gray-400 block mt-1 leading-tight">Cantidad de unidades que trae el empaque.</span>
                  </div>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Nombre presentación</label>
                  <div className="flex-1 w-full">
                    <input className={inputCls.replace('flex-1', 'w-full')} value={selectedProduct.packName} placeholder="Ej: Six Pack, Caja"
                      onChange={e => setSelectedProduct({ ...selectedProduct, packName: e.target.value })}
                      onBlur={() => updateProductField(selectedProduct.id, 'packName', selectedProduct.packName)} />
                    <span className="text-[10px] text-gray-400 block mt-1 leading-tight">Palabra para el pedido (Ej: Paca, Caja).</span>
                  </div>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Cocina</label>
                  <input className={inputCls} value={selectedProduct.kitchen}
                    onChange={e => setSelectedProduct({ ...selectedProduct, kitchen: e.target.value })}
                    onBlur={() => updateProductField(selectedProduct.id, 'kitchen', selectedProduct.kitchen)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Código</label>
                  <input className={inputCls} value={selectedProduct.code || ''}
                    onChange={e => setSelectedProduct({ ...selectedProduct, code: e.target.value })}
                    onBlur={() => updateProductField(selectedProduct.id, 'code', selectedProduct.code || null)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Activo</label>
                  <input type="checkbox" className={checkboxCls} checked={selectedProduct.active}
                    onChange={() => updateProductField(selectedProduct.id, 'active', !selectedProduct.active)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Menú Online</label>
                  <input type="checkbox" className={checkboxCls} checked={selectedProduct.onlineMenu}
                    onChange={() => updateProductField(selectedProduct.id, 'onlineMenu', !selectedProduct.onlineMenu)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Excluir de Reportes</label>
                  <input type="checkbox" className={checkboxCls} checked={selectedProduct.excludeFromReports}
                    onChange={() => updateProductField(selectedProduct.id, 'excludeFromReports', !selectedProduct.excludeFromReports)} />
                  <span className="text-[10px] text-gray-400 col-span-2 -mt-2">No suma a Venta General Bruta ni barra superior</span>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Favorito</label>
                  <input type="checkbox" className={checkboxCls} checked={selectedProduct.favorite}
                    onChange={() => toggleFavorite(selectedProduct)} />
                </FormRow>

                {/* Image Upload */}
                <div className="border-t border-gray-200 pt-5 mt-2">
                  <div className="flex items-center gap-3 mb-3">
                    <label className={labelCls}>Imagen</label>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadProductImage(selectedProduct.id, file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {uploadingImage ? 'Subiendo...' : selectedProduct.imageUrl ? 'Cambiar' : 'Subir imagen'}
                    </button>
                    {selectedProduct.imageUrl && (
                      <button
                        onClick={() => deleteProductImage(selectedProduct.id)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-red-500 hover:bg-red-50 transition"
                      >
                        <X className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    )}
                  </div>
                  {selectedProduct.imageUrl && (
                    <img
                      src={getImageUrl(selectedProduct.imageUrl)}
                      alt={selectedProduct.name}
                      className="w-40 h-40 object-cover rounded-lg border border-gray-200 shadow-sm"
                    />
                  )}
                </div>
              </DetailCard>

              {/* Danger zone */}
              <div className="bg-white rounded-xl shadow-sm border border-red-200 max-w-lg mt-4">
                <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <h3 className="font-bold text-red-600 text-sm">Zona peligrosa</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-600 mb-4">
                    Eliminar este producto lo removerá permanentemente del sistema, incluyendo su historial de ventas asociado.
                  </p>
                  <button
                    onClick={() => setDeleteProductModal(selectedProduct)}
                    className="flex items-center gap-2 px-4 py-2 rounded bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 text-sm font-semibold transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar producto
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── NEW PRODUCT ── */}
          {view === 'new_product' && (
            <div className="p-6">
              <PanelBackHeader title="Nuevo Producto" />
              <DetailCard title="Datos del producto">
                <FormRow>
                  <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                  <input className={inputCls} placeholder="Ej: Hamburguesa clásica" value={newProduct.name}
                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Categoría <span className="text-red-500">*</span></label>
                  <select className={inputCls} value={newProduct.categoryId}
                    onChange={e => setNewProduct({ ...newProduct, categoryId: e.target.value })}>
                    <option value="">— Seleccionar —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Precio <span className="text-red-500">*</span></label>
                  <input type="number" min="0" className={inputCls} placeholder="0"
                    value={newProduct.price}
                    onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Costo</label>
                  <input type="number" min="0" className={inputCls} placeholder="0"
                    value={(newProduct as any).cost || ''}
                    onChange={e => setNewProduct({ ...newProduct, cost: e.target.value } as any)} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Proveedor</label>
                  <select className={inputCls} value={(newProduct as any).supplierId || ''}
                    onChange={e => setNewProduct({ ...newProduct, supplierId: e.target.value || undefined } as any)}>
                    <option value="">— Sin proveedor —</option>
                    {suppliers.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Cocina</label>
                  <input className={inputCls} placeholder="Cocina" value={newProduct.kitchen}
                    onChange={e => setNewProduct({ ...newProduct, kitchen: e.target.value })} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Código</label>
                  <input className={inputCls} placeholder="Opcional" value={newProduct.code}
                    onChange={e => setNewProduct({ ...newProduct, code: e.target.value })} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Activo</label>
                  <input type="checkbox" className={checkboxCls} checked={newProduct.active}
                    onChange={() => setNewProduct({ ...newProduct, active: !newProduct.active })} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Menú Online</label>
                  <input type="checkbox" className={checkboxCls} checked={newProduct.onlineMenu}
                    onChange={() => setNewProduct({ ...newProduct, onlineMenu: !newProduct.onlineMenu })} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Favorito</label>
                  <input type="checkbox" className={checkboxCls} checked={newProduct.favorite}
                    onChange={() => setNewProduct({ ...newProduct, favorite: !newProduct.favorite })} />
                </FormRow>

                {newProductError && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{newProductError}</p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={goBack} className="px-5 py-2 rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                    Cancelar
                  </button>
                  <button
                    onClick={submitNewProduct}
                    disabled={newProductLoading}
                    className="px-5 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {newProductLoading ? 'Guardando...' : 'Crear Producto'}
                  </button>
                </div>
              </DetailCard>
            </div>
          )}

          {/* ── NEW CATEGORY ── */}
          {view === 'new_category' && (
            <div className="p-6">
              <PanelBackHeader title="Nueva Categoría" />
              <DetailCard title="Datos de la categoría">
                <FormRow>
                  <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                  <input className={inputCls} placeholder="Ej: Bebidas Calientes" value={categoryForm.name}
                    onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && submitNewCategory()} />
                </FormRow>
                <FormRow>
                  <label className={labelCls}>Menú Online</label>
                  <input type="checkbox" className={checkboxCls} checked={categoryForm.onlineMenu}
                    onChange={() => setCategoryForm({ ...categoryForm, onlineMenu: !categoryForm.onlineMenu })} />
                </FormRow>

                {categoryFormError && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{categoryFormError}</p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={goBack} className="px-5 py-2 rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                    Cancelar
                  </button>
                  <button
                    onClick={submitNewCategory}
                    disabled={categoryFormLoading}
                    className="px-5 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {categoryFormLoading ? 'Guardando...' : 'Crear Categoría'}
                  </button>
                </div>
              </DetailCard>
            </div>
          )}

          {/* ── EDIT CATEGORY ── */}
          {view === 'edit_category' && editingCategory && (
            <div className="p-6">
              <PanelBackHeader title={`Editar: ${editingCategory.name}`} />
              <div className="flex flex-col gap-4 max-w-lg">
                <DetailCard title="Datos de la categoría">
                  <FormRow>
                    <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={editCategoryDraft.name}
                      onChange={e => setEditCategoryDraft({ ...editCategoryDraft, name: e.target.value })} />
                  </FormRow>
                  <FormRow>
                    <label className={labelCls}>Menú Online</label>
                    <input type="checkbox" className={checkboxCls} checked={editCategoryDraft.onlineMenu}
                      onChange={() => setEditCategoryDraft({ ...editCategoryDraft, onlineMenu: !editCategoryDraft.onlineMenu })} />
                  </FormRow>

                  {/* Category Image Upload */}
                  <div className="border-t border-gray-200 pt-5 mt-2">
                    <div className="flex items-center gap-3 mb-3">
                      <label className={labelCls}>Imagen</label>
                      <input
                        ref={categoryImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadCategoryImage(editingCategory.id, file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        onClick={() => categoryImageInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        {uploadingImage ? 'Subiendo...' : editingCategory.imageUrl ? 'Cambiar' : 'Subir imagen'}
                      </button>
                      {editingCategory.imageUrl && (
                        <button
                          onClick={() => deleteCategoryImage(editingCategory.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-red-500 hover:bg-red-50 transition"
                        >
                          <X className="h-3.5 w-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                    {editingCategory.imageUrl && (
                      <img
                        src={getImageUrl(editingCategory.imageUrl)}
                        alt={editingCategory.name}
                        className="w-40 h-40 object-cover rounded-lg border border-gray-200 shadow-sm"
                      />
                    )}
                  </div>

                  {categoryFormError && (
                    <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{categoryFormError}</p>
                  )}
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={goBack} className="px-5 py-2 rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                      Cancelar
                    </button>
                    <button
                      onClick={submitEditCategory}
                      disabled={categoryFormLoading}
                      className="px-5 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-50"
                    >
                      {categoryFormLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </DetailCard>

                {/* Danger zone */}
                <div className="bg-white rounded-xl shadow-sm border border-red-200">
                  <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <h3 className="font-bold text-red-600 text-sm">Zona peligrosa</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">
                      Eliminar esta categoría afectará a <strong>{editingCategory.products?.length ?? 0} producto(s)</strong>.
                      Puedes eliminarlos o migrarlos a otra categoría antes de confirmar.
                    </p>
                    <button
                      onClick={() => openDeleteModal(editingCategory)}
                      className="flex items-center gap-2 px-4 py-2 rounded bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 text-sm font-semibold transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar categoría
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PRODUCTS LIST ── */}
          {view === 'products' && (
            <div className="flex flex-col h-full bg-white">
              {/* Search bar */}
              <div className="p-4 bg-white border-b border-gray-100">
                <div className="flex items-center bg-[#f0f0f0] rounded overflow-hidden h-11 border border-gray-200">
                  <div className="p-3 px-5 border-r border-gray-300 bg-[#e5e5e5] h-full flex items-center justify-center">
                    <Search className="w-5 h-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    className="flex-1 h-full px-4 bg-transparent outline-none text-gray-700 text-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="px-4 text-gray-400 hover:text-gray-600">✕</button>
                  )}
                </div>
              </div>

              {/* Table header */}
              <div className="bg-[#f8f8f8] border-b border-gray-200 px-6 py-3 flex items-center text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                <span className="flex-1 pl-4">Producto</span>
                <span className="w-32 text-right">Costo</span>
                <span className="w-32 text-right">Utilidad</span>
                <span className="w-32 text-right pr-6">Precio</span>
                <span className="w-10"></span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-12 text-center text-gray-400">Cargando productos...</div>
                ) : products.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    {searchQuery
                      ? `No se encontraron resultados para "${searchQuery}"`
                      : categories.length === 0
                        ? 'Importa un archivo CSV o crea una categoría para comenzar'
                        : 'No hay productos en esta categoría'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {products.map(product => (
                      <div
                        key={product.id}
                        onClick={() => { setSelectedProduct(product); setView('product_detail'); }}
                        className={`px-6 py-4 flex items-center cursor-pointer transition-colors hover:bg-gray-50 ${!product.active ? 'opacity-40' : ''}`}
                      >
                        <span className="flex-1 font-sans font-normal text-[#333333] text-[13px] leading-[18px] pl-4">{product.name}</span>
                        
                        <span className="w-32 text-right font-sans font-normal text-gray-500 text-[13px] leading-[18px]">
                          ${product.cost.toLocaleString('es-CO')}
                        </span>

                        <span className="w-32 text-right font-sans font-normal text-[13px] leading-[18px]">
                          {product.cost > 0 && product.price > 0 ? (
                            <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                              {Math.round(((product.price - product.cost) / product.price) * 100)}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </span>

                        <span className="w-32 text-right font-sans font-bold text-[#333333] text-[13px] leading-[18px] pr-6">
                          ${product.price.toLocaleString('es-CO')}
                        </span>
                        <span className="w-10 flex justify-center">
                          <button
                            onClick={e => { e.stopPropagation(); toggleFavorite(product); }}
                            className={`p-1 transition-transform active:scale-125 ${product.favorite ? 'text-orange-400' : 'text-gray-300 hover:text-orange-200'}`}
                          >
                            <Star className={`h-5 w-5 ${product.favorite ? 'fill-current' : ''}`} />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── IMPORT CSV MODAL ────────────────────────────────────────────── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="bg-orange-50 border-b border-orange-100 px-6 py-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Importar Productos por CSV</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Instrucciones de formato</p>
                </div>
              </div>
              <button 
                onClick={() => setImportModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 transition mt-0.5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-[13px] leading-relaxed text-[#333333]">
              <p>El archivo CSV debe cumplir estrictamente con el siguiente orden de columnas (puede omitir o incluir fila de encabezados):</p>
              <ul className="list-disc pl-5 space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <li><strong className="font-semibold">Columna A:</strong> ID del producto / Código (Opcional, dejar vacío si no aplica)</li>
                <li><strong className="font-semibold">Columna B:</strong> Categoría del producto</li>
                <li><strong className="font-semibold">Columna C:</strong> Nombre del producto</li>
                <li><strong className="font-semibold">Columna D:</strong> Precio</li>
                <li><strong className="font-semibold">Columna E:</strong> Activo (Escribe "Sí", "Activo", "1" o "S")</li>
                <li><strong className="font-semibold">Columna F:</strong> Favorito (Escribe "Sí", "Activo", "1" o "S")</li>
                <li><strong className="font-semibold">Columna G:</strong> Menú Online (Escribe "Sí", "Activo", "1" o "S")</li>
                <li><strong className="font-semibold">Columna H:</strong> Cocina (Ej: "Cocina", "Barra", etc)</li>
              </ul>
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                onClick={() => setImportModalOpen(false)}
                className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition"
              >
                <Upload className="h-4 w-4" />
                Seleccionar Archivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CATEGORY MODAL ─────────────────────────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Eliminar categoría</h3>
                  <p className="text-sm text-gray-500 mt-0.5">"{deleteModal.category.name}"</p>
                </div>
              </div>
              <button onClick={() => setDeleteModal(null)} className="text-gray-400 hover:text-gray-600 transition mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Esta categoría tiene <strong className="text-gray-900">{deleteModal.category.products?.length ?? 0} producto(s)</strong>.
                ¿Qué deseas hacer con ellos?
              </p>

              {/* Option: delete products */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${deleteAction === 'delete_products' ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="deleteAction"
                  value="delete_products"
                  checked={deleteAction === 'delete_products'}
                  onChange={() => setDeleteAction('delete_products')}
                  className="accent-red-500 mt-0.5"
                />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Eliminar todos los productos</p>
                  <p className="text-xs text-gray-500 mt-0.5">Los productos de esta categoría serán eliminados permanentemente.</p>
                </div>
              </label>

              {/* Option: migrate products */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${deleteAction === 'migrate_products' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="deleteAction"
                  value="migrate_products"
                  checked={deleteAction === 'migrate_products'}
                  onChange={() => setDeleteAction('migrate_products')}
                  className="accent-orange-500 mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Migrar productos a otra categoría</p>
                  <p className="text-xs text-gray-500 mt-0.5">Los productos serán movidos a la categoría que elijas.</p>
                  {deleteAction === 'migrate_products' && (
                    <select
                      className="mt-3 w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 focus:border-orange-400 outline-none"
                      value={migrateToCategoryId}
                      onChange={e => setMigrateToCategoryId(e.target.value)}
                    >
                      <option value="">— Seleccionar categoría destino —</option>
                      {otherCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCategory}
                disabled={deleteLoading || (deleteAction === 'migrate_products' && !migrateToCategoryId)}
                className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-40"
              >
                {deleteLoading ? 'Eliminando...' : 'Confirmar eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE PRODUCT MODAL ─────────────────────────────────────────── */}
      {deleteProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Eliminar producto</h3>
                  <p className="text-sm text-gray-500 mt-0.5">"{deleteProductModal.name}"</p>
                </div>
              </div>
              <button onClick={() => setDeleteProductModal(null)} className="text-gray-400 hover:text-gray-600 transition mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6">
              <p className="text-sm text-gray-600">
                ¿Estás seguro de que deseas eliminar el producto <strong className="text-gray-900">"{deleteProductModal.name}"</strong>?
                Esta acción es permanente y no se puede deshacer. Se eliminarán también los items de venta asociados.
              </p>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteProductModal(null)}
                className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProduct}
                disabled={deleteProductLoading}
                className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-40"
              >
                {deleteProductLoading ? 'Eliminando...' : 'Confirmar eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
