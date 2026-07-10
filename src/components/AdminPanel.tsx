
import React, { useState, useEffect, useRef } from 'react';
import { Product, Order, Customer, ZipRange, CategoryItem, SubCategoryItem, OrderStatus, Complement, PaymentSettings, Coupon, Table } from '../types.ts';
import { compressImage } from '../services/imageService.ts';
import { dbService } from '../services/dbService.ts';
import { writeBatch, doc } from 'firebase/firestore';

const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
const APP_VERSION = "v6.0 (Subcategorias & Import SQL)";

interface AdminPanelProps {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  zipRanges: ZipRange[];
  categories: CategoryItem[];
  subCategories: SubCategoryItem[];
  complements: Complement[];
  coupons: Coupon[];
  tables: Table[];
  isStoreOpen: boolean;
  onToggleStore: () => void;
  isMaintenanceMode: boolean;
  onToggleMaintenance: () => void;
  themeColor: string;
  onUpdateThemeColor: (color: string) => void;
  isKioskMode: boolean;
  onToggleKioskMode: () => void;
  logoUrl: string;
  onUpdateLogo: (url: string) => void;
  storeName: string;
  onUpdateStoreName: (name: string) => void;
  socialLinks: { 
    instagram?: string; 
    whatsapp?: string; 
    facebook?: string;
    googleTagId?: string;
    facebookPixelId?: string;
    instagramPixelId?: string;
    address?: string;
    city?: string;
  };
  onUpdateSocialLinks: (links: { 
    instagram?: string; 
    whatsapp?: string; 
    facebook?: string;
    googleTagId?: string;
    facebookPixelId?: string;
    instagramPixelId?: string;
    address?: string;
    city?: string;
  }) => void;
  paymentConfig: {
    mercadopagoAccessToken: string;
    mercadopagoPublicKey?: string;
    pagseguroEmail?: string;
    pagseguroToken?: string;
  };
  onUpdatePaymentConfig: (config: {
    mercadopagoAccessToken?: string;
    mercadopagoPublicKey?: string;
    pagseguroEmail?: string;
    pagseguroToken?: string;
  }) => void;
  authSettings: {
    adminUser: string;
    adminPass: string;
    motoboyPass: string;
  };
  onUpdateAuthSettings: (settings: {
    adminUser: string;
    adminPass: string;
    motoboyPass: string;
  }) => void;
  onAddProduct: (p: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onUpdateProduct: (p: Product) => void;
  onUpdateOrderStatus: (id: string, status: OrderStatus) => void;
  onDeleteOrder: (id: string) => Promise<void>;
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => void;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (id: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => void;
  onAddSubCategory: (catId: string, name: string) => void;
  onUpdateSubCategory: (id: string, name: string, categoryId: string) => void;
  onRemoveSubCategory: (id: string) => Promise<void>;
  onAddComplement: (name: string, price: number, applicableCategories?: string[]) => void;
  onUpdateComplement: (id: string, name: string, price: number, applicableCategories?: string[]) => void;
  onToggleComplement: (id: string) => void;
  onRemoveComplement: (id: string) => Promise<void>;
  onAddZipRange: (start: string, end: string, fee: number) => void;
  onUpdateZipRange: (id: string, start: string, end: string, fee: number) => void;
  onRemoveZipRange: (id: string) => Promise<void>;
  onAddCoupon: (code: string, discount: number, type: 'PERCENT' | 'FIXED') => void;
  onRemoveCoupon: (id: string) => Promise<void>;
  paymentSettings: PaymentSettings[];
  onTogglePaymentMethod: (id: string) => void;
  onAddPaymentMethod: (name: string, type: 'ONLINE' | 'DELIVERY') => void;
  onRemovePaymentMethod: (id: string) => Promise<void>;
  onUpdatePaymentSettings: (id: string, updates: Partial<PaymentSettings>) => void;
  onLogout: () => void;
  onBackToSite: () => void;
  onWaiterMode?: () => void;
}

type AdminView = 'dashboard' | 'pedidos' | 'produtos' | 'categorias' | 'subcategorias' | 'adicionais' | 'cupons' | 'entregas' | 'clientes' | 'pagamentos' | 'mesas' | 'ajustes';

type DeleteTarget = {
  type: 'ORDER' | 'PRODUCT' | 'CATEGORY' | 'SUBCATEGORY' | 'COMPLEMENT' | 'COUPON' | 'ZIP' | 'PAYMENT' | 'TABLE';
  id: string;
  name?: string;
};

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { 
    products, orders, customers, zipRanges, categories, subCategories, complements, coupons, tables, isStoreOpen, onToggleStore, isMaintenanceMode, onToggleMaintenance, themeColor, onUpdateThemeColor, isKioskMode, onToggleKioskMode,
    logoUrl, onUpdateLogo, storeName, onUpdateStoreName, socialLinks, onUpdateSocialLinks, onAddProduct, onDeleteProduct, onUpdateProduct, 
    onUpdateOrderStatus, onDeleteOrder, onUpdateCustomer, onAddCategory, onRemoveCategory, onUpdateCategory, onAddSubCategory, 
    onUpdateSubCategory, onRemoveSubCategory, onAddComplement, onToggleComplement, onRemoveComplement, 
    onAddZipRange, onRemoveZipRange, onAddCoupon, onRemoveCoupon, onLogout, onBackToSite, onWaiterMode,
    paymentSettings, onTogglePaymentMethod, onAddPaymentMethod, onRemovePaymentMethod, onUpdatePaymentSettings,
    authSettings, onUpdateAuthSettings,
    paymentConfig, onUpdatePaymentConfig
  } = props;

  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [activeOrderTab, setActiveOrderTab] = useState<OrderStatus | 'TODOS'>('NOVO');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [showZeroStockConfirm, setShowZeroStockConfirm] = useState(false);
  const [showRestoreStockConfirm, setShowRestoreStockConfirm] = useState(false);
  const [showDeleteAllProductsConfirm, setShowDeleteAllProductsConfirm] = useState(false);
  const [showDeleteAllComplementsConfirm, setShowDeleteAllComplementsConfirm] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [operationProgress, setOperationProgress] = useState<{
    active: boolean;
    label: string;
    current: number;
    total: number;
    percentage: number;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null); 
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', price: 0, category: '', subCategory: '', description: '', image: '', rating: 5.0 });
  const [isProcessingImg, setIsProcessingImg] = useState(false);

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  
  const [editingSubCatId, setEditingSubCatId] = useState<string | null>(null);
  const [subCatName, setSubCatName] = useState('');
  const [subCatParent, setSubCatParent] = useState('');

  const [compName, setCompName] = useState('');
  const [compPrice, setCompPrice] = useState<number>(0);

  const [cpCode, setCpCode] = useState('');
  const [cpDiscount, setCpDiscount] = useState<number>(0);
  const [cpType, setCpType] = useState<'PERCENT' | 'FIXED'>('PERCENT');

  const [zipStart, setZipStart] = useState('');
  const [zipEnd, setZipEnd] = useState('');
  const [zipFee, setZipFee] = useState<number>(0);

  const [payName, setPayName] = useState('');
  const [payType, setPayType] = useState<'ONLINE' | 'DELIVERY'>('DELIVERY');

  const [localInstagram, setLocalInstagram] = useState(socialLinks?.instagram || '');
  const [localWhatsapp, setLocalWhatsapp] = useState(socialLinks?.whatsapp || '');
  const [localFacebook, setLocalFacebook] = useState(socialLinks?.facebook || '');
  const [localGoogleTag, setLocalGoogleTag] = useState(socialLinks?.googleTagId || '');
  const [localFacebookPixel, setLocalFacebookPixel] = useState(socialLinks?.facebookPixelId || '');
  const [localInstagramPixel, setLocalInstagramPixel] = useState(socialLinks?.instagramPixelId || '');

  const [localAdminUser, setLocalAdminUser] = useState(authSettings.adminUser || 'admin');
  const [localAdminPass, setLocalAdminPass] = useState(authSettings.adminPass || 'admin123');
  const [localMotoboyPass, setLocalMotoboyPass] = useState(authSettings.motoboyPass || 'motoboy123');
  const [localWaiterPass, setLocalWaiterPass] = useState((authSettings as any).waiterPass || 'garcom123');

  const [localAddress, setLocalAddress] = useState(socialLinks?.address || 'Rua Exemplo, 123 - Centro');
  const [localCity, setLocalCity] = useState(socialLinks?.city || 'Uberaba - MG');
  const [localMercadoPagoToken, setLocalMercadoPagoToken] = useState(paymentConfig?.mercadopagoAccessToken || '');
  const [localMercadoPagoPublicKey, setLocalMercadoPagoPublicKey] = useState(paymentConfig?.mercadopagoPublicKey || '');
  const [localPagSeguroEmail, setLocalPagSeguroEmail] = useState(paymentConfig?.pagseguroEmail || '');
  const [localPagSeguroToken, setLocalPagSeguroToken] = useState(paymentConfig?.pagseguroToken || '');

  const [isImporting, setIsImporting] = useState(false);
  const [importLog, setImportLog] = useState('');
  const [tableName, setTableName] = useState('');
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMercadoPagoToken(paymentConfig?.mercadopagoAccessToken || '');
    setLocalMercadoPagoPublicKey(paymentConfig?.mercadopagoPublicKey || '');
    setLocalPagSeguroEmail(paymentConfig?.pagseguroEmail || '');
    setLocalPagSeguroToken(paymentConfig?.pagseguroToken || '');
  }, [paymentConfig]);

  useEffect(() => {
    setLocalInstagram(socialLinks?.instagram || '');
    setLocalWhatsapp(socialLinks?.whatsapp || '');
    setLocalFacebook(socialLinks?.facebook || '');
    setLocalGoogleTag(socialLinks?.googleTagId || '');
    setLocalFacebookPixel(socialLinks?.facebookPixelId || '');
    setLocalInstagramPixel(socialLinks?.instagramPixelId || '');
    setLocalAddress(socialLinks?.address || 'Rua Exemplo, 123 - Centro');
    setLocalCity(socialLinks?.city || 'Uberaba - MG');
  }, [socialLinks]);

  useEffect(() => {
    setLocalAdminUser(authSettings.adminUser);
    setLocalAdminPass(authSettings.adminPass);
    setLocalMotoboyPass(authSettings.motoboyPass);
    setLocalWaiterPass((authSettings as any).waiterPass || 'garcom123');
  }, [authSettings]);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.loop = true;
  }, []);

  const stopAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    // O alarme toca APENAS para pedidos NOVOS (finalizados)
    const newOrders = orders.filter(o => o.status === 'NOVO' && !deletedIds.includes(o.id));
    const hasNewOrders = newOrders.length > 0;

    if (hasNewOrders && audioEnabled) {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(e => {
          console.warn("Autoplay bloqueado pelo navegador. O usuário precisa interagir com a página primeiro.", e);
        });
      }
    } else {
      stopAlarm();
    }
  }, [orders, deletedIds, audioEnabled]);

  useEffect(() => {
    // Cancela automaticamente pedidos "AGUARDANDO PAGAMENTO" que passaram de 3 minutos
    const interval = setInterval(() => {
      const now = new Date().getTime();
      orders.forEach(order => {
        if (order.status === 'AGUARDANDO PAGAMENTO') {
          const orderTime = new Date(order.createdAt).getTime();
          const diffMinutes = (now - orderTime) / (1000 * 60);
          if (diffMinutes >= 3) {
            console.log(`[Auto-Cancel] Cancelando pedido ${order.id} por expiração de tempo (3 min)`);
            onUpdateOrderStatus(order.id, 'CANCELADO');
          }
        }
      });
    }, 60000); // Checa a cada 1 minuto

    return () => clearInterval(interval);
  }, [orders, onUpdateOrderStatus]);

  const testAlarm = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setTimeout(stopAlarm, 3000);
      }).catch(e => alert("Erro ao tocar som. Verifique se o navegador bloqueou o áudio."));
    }
  };

  const handlePrintOrder = (order: Order) => {
    const itemsHtml = order.items.map(item => `
      <div class="item-row">
        <span>${item.quantity}x ${item.name}</span>
        <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
      </div>
      ${(item.selectedComplements || []).map(c => `<div style="font-size:10px; padding-left:10px; color:#555;">+ ${c.name}</div>`).join('')}
    `).join('');

    const printContent = `
      <html>
      <head>
        <title>Cupom #${order.id.substring(0, 5)}</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; background: #fff; color: #000; font-weight: 600; }
          .coupon-content { width: 300px; margin: 0 auto; padding: 10px; font-size: 13px; line-height: 1.3; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .header h1 { font-size: 18px; font-weight: 900; margin: 0; }
          .header h2 { font-size: 16px; font-weight: 800; margin: 5px 0; }
          .info { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; font-weight: 700; }
          .items { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; font-weight: 700; }
          .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .totals { font-size: 14px; font-weight: 700; }
          .totals p { margin: 2px 0; display: flex; justify-content: space-between; }
          .total-final { font-size: 18px; font-weight: 900; margin-top: 10px; border-top: 2px solid #000; padding-top: 5px; display: flex; justify-content: space-between; }
          .footer { text-align: center; font-size: 11px; margin-top: 20px; font-weight: 700; }
          @media print { @page { margin: 0; } body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="coupon-content">
          <div class="header">
            <h1>MEU DELIVERY</h1>
            <h2>Pedido #${order.id.substring(0,5)}</h2>
            <p>${new Date(order.createdAt).toLocaleString('pt-BR')}</p>
          </div>
          <div class="info">
            <p><strong>Cli:</strong> ${order.customerName}</p>
            <p><strong>Tel:</strong> ${order.customerPhone}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Pag:</strong> ${order.paymentMethod}</p>
            ${order.changeFor ? `<p><strong>Troco p/:</strong> R$ ${order.changeFor.toFixed(2)}</p>` : ''}
            ${order.deliveryType === 'DELIVERY' ? `<p><strong>End:</strong> ${order.customerAddress}</p>` : (order.deliveryType === 'TABLE' ? `<p><strong>${order.customerAddress}</strong></p>` : '<p><strong>RETIRADA NO BALCÃO</strong></p>')}
             ${order.couponCode ? `<p><strong>Cupom:</strong> ${order.couponCode}</p>` : ''}
          </div>
          <div class="items">${itemsHtml}</div>
          <div class="totals">
            <p><span>Subtotal:</span> <span>R$ ${(order.total - order.deliveryFee + (order.discountValue || 0)).toFixed(2)}</span></p>
            ${order.deliveryFee > 0 ? `<p><span>Taxa Entrega:</span> <span>R$ ${order.deliveryFee.toFixed(2)}</span></p>` : ''}
            ${order.discountValue ? `<p><span>Desconto:</span> <span>- R$ ${order.discountValue.toFixed(2)}</span></p>` : ''}
            <div class="total-final">
              <span>TOTAL:</span>
              <span>R$ ${order.total.toFixed(2)}</span>
            </div>
            ${order.changeFor ? `<p>Troco: R$ ${(order.changeFor - order.total).toFixed(2)}</p>` : ''}
          </div>
          <div class="footer">
            <p>Obrigado pela preferência!</p>
            <p>CNPJ: 64.412.248/0001-42 - BERTIM PASTEL E HOTDOG LTDA</p>
            <p>AV. LUCAS BORGES, 586 - FABRÍCIO</p>
            <p>UBERABA - MG - FONE: 34-9-9262-7077</p>
            <p>IE: 53999960035</p>
            <p>www.bertimpastelhotdog.com.br</p>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
        </script>
      </body>
      </html>
    `;

    try {
        const printWindow = window.open('', '_blank', 'width=350,height=600,menubar=no,toolbar=no,location=no,status=no,titlebar=no');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(printContent);
            printWindow.document.close();
        }
    } catch (e) {
        console.error("Print error:", e);
    }
  };

  const handleRightSidebarClick = (status: OrderStatus | 'TODOS') => {
    if (selectedOrderId && status !== 'TODOS') {
      onUpdateOrderStatus(selectedOrderId, status as OrderStatus);
      const order = orders.find(o => o.id === selectedOrderId);
      if (order && order.status === 'NOVO' && status !== 'NOVO') {
        stopAlarm();
      }
      setSelectedOrderId(null);
    } else {
      setActiveOrderTab(status);
      setSelectedOrderId(null);
    }
  };

  const requestDelete = (type: DeleteTarget['type'], id: string, name?: string) => {
    setDeleteTarget({ type, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      switch (deleteTarget.type) {
        case 'ORDER':
          setDeletedIds(prev => [...prev, deleteTarget.id]);
          await onDeleteOrder(deleteTarget.id);
          if (selectedOrderId === deleteTarget.id) setSelectedOrderId(null);
          stopAlarm();
          break;
        case 'PRODUCT': await onDeleteProduct(deleteTarget.id); break;
        case 'CATEGORY': await onRemoveCategory(deleteTarget.id); break;
        case 'SUBCATEGORY': await onRemoveSubCategory(deleteTarget.id); break;
        case 'COMPLEMENT': await onRemoveComplement(deleteTarget.id); break;
        case 'COUPON': await onRemoveCoupon(deleteTarget.id); break;
        case 'ZIP': await onRemoveZipRange(deleteTarget.id); break;
        case 'PAYMENT': await onRemovePaymentMethod(deleteTarget.id); break;
        case 'TABLE': await dbService.remove('tables', deleteTarget.id); break;
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir item. Verifique sua conexão ou permissões.");
      if (deleteTarget.type === 'ORDER') {
        setDeletedIds(prev => prev.filter(id => id !== deleteTarget.id));
      }
    }
    setDeleteTarget(null);
  };

  const handleImageUpload = async (file: File, isLogo: boolean = false) => {
    if (!file) return;
    setIsProcessingImg(true);
    try {
      const compressed = await compressImage(file);
      if (isLogo) onUpdateLogo(compressed);
      else setNewProduct(prev => ({ ...prev, image: compressed }));
      setIsProcessingImg(false);
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      setIsProcessingImg(false);
    }
  };

  const handleEditProductClick = (p: Product) => {
    setEditingId(p.id);
    setNewProduct({ ...p });
    if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveProduct = async () => {
    if (editingId && newProduct.name) {
      onUpdateProduct({ ...newProduct, id: editingId } as Product);
      setEditingId(null);
    } else if (newProduct.name) {
      await onAddProduct(newProduct);
    }
    setNewProduct({ name: '', price: 0, category: '', subCategory: '', description: '', image: '', rating: 5.0 });
  };

  const handleEditCategoryClick = (c: CategoryItem) => {
    setEditingCatId(c.id);
    setCatName(c.name);
    if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveCategory = () => {
    if (catName) {
      if (editingCatId) {
        onUpdateCategory(editingCatId, catName);
        setEditingCatId(null);
      } else onAddCategory(catName);
      setCatName('');
    }
  };

  const handleEditSubCategoryClick = (s: SubCategoryItem) => {
    setEditingSubCatId(s.id);
    setSubCatName(s.name);
    setSubCatParent(s.categoryId);
    if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveSubCategory = () => {
    if (subCatName && subCatParent) {
      if (editingSubCatId) {
        onUpdateSubCategory(editingSubCatId, subCatName, subCatParent);
        setEditingSubCatId(null);
      } else onAddSubCategory(subCatParent, subCatName);
      setSubCatName('');
    }
  };

  const handleEditTableClick = (t: any) => {
    setEditingTableId(t.id);
    setTableName(t.number);
    if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveTable = () => {
    if (tableName) {
      if (editingTableId) {
        dbService.save('tables', editingTableId, { number: tableName });
        setEditingTableId(null);
      } else {
        dbService.save('tables', Math.random().toString(36).substring(7), { number: tableName, status: 'FREE' });
      }
      setTableName('');
    }
  };

  const handleConfirmPassSave = () => {
    onUpdateAuthSettings({ 
      adminUser: localAdminUser, 
      adminPass: localAdminPass, 
      motoboyPass: localMotoboyPass,
      waiterPass: localWaiterPass
    } as any);
    setShowPassConfirm(false);
  };

  const handleImportSQL = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportLog('Lendo arquivo SQL...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      let count = 0;

      setImportLog(`Processando ${lines.length} linhas...`);

      for (const line of lines) {
        // Busca padrões simples de INSERT de clientes
        const emailMatch = line.match(/'([^']+@[^']+)'/);
        const nameMatch = line.match(/INSERT INTO .* VALUES.*'([^']+)',/i);
        const phoneMatch = line.match(/['"](\d{10,13})['"]/);

        if (emailMatch) {
          const email = emailMatch[1];
          const name = nameMatch ? nameMatch[1] : 'Cliente Importado';
          const phone = phoneMatch ? phoneMatch[1] : '0000000000';

          await dbService.save('customers', email, {
            id: email,
            name,
            email,
            phone,
            password: 'user' + Math.floor(Math.random() * 900),
            address: 'Importado',
            neighborhood: 'Uberaba',
            zipCode: '38000000',
            totalOrders: 0,
            points: 0,
            lastOrder: new Date().toISOString()
          });
          count++;
        }
      }
      setImportLog(`Sucesso! ${count} clientes importados.`);
      setTimeout(() => setIsImporting(false), 3000);
    };
    reader.readAsText(file);
  };

  const activeOrdersCount = orders.filter(o => o.status === 'NOVO' && !deletedIds.includes(o.id)).length;

  const cardClass = "bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all";
  const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all placeholder:text-slate-400";
  const labelClass = "text-xs font-bold uppercase text-slate-500 tracking-wider ml-1 mb-1 block";
  const buttonClass = "bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95";
  const editButtonClass = "bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95";

  const ORDER_STATUSES: (OrderStatus | 'TODOS')[] = ['TODOS', 'AGUARDANDO PAGAMENTO', 'NOVO', 'PREPARANDO', 'PRONTO PARA RETIRADA', 'SAIU PARA ENTREGA', 'FINALIZADO', 'CANCELADO'];

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'AGUARDANDO PAGAMENTO': return 'bg-slate-200 text-slate-600 border-slate-300 animate-pulse';
      case 'NOVO': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PREPARANDO': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'PRONTO PARA RETIRADA': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'SAIU PARA ENTREGA': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'FINALIZADO': return 'bg-red-100 text-red-700 border-red-200';
      case 'CANCELADO': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Lógica para filtrar subcategorias baseadas na categoria selecionada no produto
  const currentCategoryObj = categories.find(c => c.name === newProduct.category);
  const filteredSubCategories = currentCategoryObj 
    ? subCategories.filter(s => s.categoryId === currentCategoryObj.id)
    : [];

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 font-sans selection:bg-red-200 selection:text-red-900">
      <aside className="w-full lg:w-72 max-h-[300px] lg:max-h-none bg-slate-950 flex flex-col border-r border-slate-800 shrink-0 z-30">
        <div className="p-8 border-b border-slate-800/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-red-600 rounded-[24px] shadow-xl shadow-red-900/40 flex items-center justify-center mb-4 border-4 border-white/10 group cursor-pointer overflow-hidden relative" onClick={onBackToSite}>
             {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" alt="Logo" referrerPolicy="no-referrer" /> : <span className="text-5xl">🏪</span>}
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">DELIVERY <span className="text-red-500">ADMIN</span></h2>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-3 h-3 rounded-full ${isStoreOpen ? 'bg-red-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{isStoreOpen ? 'Loja Aberta' : 'Loja Fechada'}</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
          <NavItem active={activeView === 'dashboard'} icon="📊" label="Dashboard" onClick={() => setActiveView('dashboard')} />
          <NavItem active={activeView === 'pedidos'} icon="🛍️" label="Pedidos" onClick={() => setActiveView('pedidos')} badge={activeOrdersCount > 0 ? activeOrdersCount : undefined} />
          
          <div className="pt-6 pb-2 px-4 text-xs font-black text-slate-600 uppercase tracking-widest">Cardápio</div>
          <NavItem active={activeView === 'produtos'} icon="🍔" label="Produtos" onClick={() => setActiveView('produtos')} />
          <NavItem active={activeView === 'categorias'} icon="📁" label="Categorias" onClick={() => setActiveView('categorias')} />
          <NavItem active={activeView === 'subcategorias'} icon="🌿" label="Subcategorias" onClick={() => setActiveView('subcategorias')} />
          <NavItem active={activeView === 'adicionais'} icon="➕" label="Adicionais" onClick={() => setActiveView('adicionais')} />
          
          <div className="pt-6 pb-2 px-4 text-xs font-black text-slate-600 uppercase tracking-widest">Gestão</div>
          <NavItem active={activeView === 'cupons'} icon="🏷️" label="Cupons" onClick={() => setActiveView('cupons')} />
          <NavItem active={activeView === 'entregas'} icon="🚚" label="Taxas Frete" onClick={() => setActiveView('entregas')} />
          <NavItem active={activeView === 'clientes'} icon="👥" label="Clientes" onClick={() => setActiveView('clientes')} />
          <NavItem active={activeView === 'pagamentos'} icon="💳" label="Pagamentos" onClick={() => setActiveView('pagamentos')} />
          <NavItem active={activeView === 'ajustes'} icon="⚙️" label="Ajustes" onClick={() => setActiveView('ajustes')} />
        </nav>

        <div className="p-4 border-t border-slate-800/50 bg-slate-950/50">
           <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all font-black uppercase text-xs tracking-widest">
             🚪 <span>Sair do Painel</span>
           </button>
           <div className="mt-2 text-center text-[10px] font-bold text-slate-600 uppercase">{APP_VERSION}</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative h-full overflow-hidden">
        <header className="h-24 bg-slate-950 border-b border-slate-800 px-8 flex items-center justify-between shrink-0 z-20 shadow-md shadow-slate-900/50">
           <div className="flex items-center gap-6">
              <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                <span className="p-2.5 bg-slate-800 text-slate-200 rounded-xl text-xl border border-slate-700 shadow-sm">
                  {activeView === 'dashboard' ? '📊' : activeView === 'pedidos' ? '🛍️' : '⚙️'}
                </span>
                {activeView}
              </h1>
              <button onClick={onToggleMaintenance} className={`hidden md:flex items-center gap-3 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isMaintenanceMode ? 'bg-amber-600/10 border-amber-500 text-amber-500 hover:bg-amber-600/20' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800/80'}`}>
                <div className={`w-2 h-2 rounded-full ${isMaintenanceMode ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`}></div>
                {isMaintenanceMode ? '🚧 MANUTENÇÃO ATIVA' : '🌐 SITE ONLINE'}
              </button>
              <button onClick={onToggleStore} className={`hidden md:flex items-center gap-3 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isStoreOpen ? 'bg-emerald-600/10 border-emerald-500 text-emerald-500 hover:bg-emerald-600/20' : 'bg-red-600/10 border-red-500 text-red-500 hover:bg-red-600/20'}`}>
                <div className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                {isStoreOpen ? 'LOJA ABERTA' : 'LOJA FECHADA'}
              </button>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={onWaiterMode || onBackToSite} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2">
               <span>🤵</span> Atendimento Mesa
             </button>
             <button onClick={onBackToSite} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/20">Ver Site</button>
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-8 sm:p-10 overflow-y-auto no-scrollbar scroll-smooth">
            {activeView === 'dashboard' && (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in">
                 <div className={cardClass}>
                   <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Total de Pedidos</p>
                   <p className="text-4xl font-black text-slate-800 mt-2">{orders.length}</p>
                 </div>
                 <div className={cardClass}>
                   <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Faturamento</p>
                   <p className="text-4xl font-black text-red-600 mt-2">R$ {orders.reduce((acc, o) => acc + o.total, 0).toFixed(2)}</p>
                 </div>
                 <div className={cardClass}>
                   <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Clientes</p>
                   <p className="text-4xl font-black text-blue-600 mt-2">{customers.length}</p>
                 </div>
                 <div className={cardClass}>
                   <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Produtos Ativos</p>
                   <p className="text-4xl font-black text-purple-600 mt-2">{products.length}</p>
                 </div>
               </div>
            )}

            {activeView === 'pedidos' && (
              <div className="animate-in fade-in duration-500">
                 <div className="grid grid-cols-1 gap-8 w-full max-w-4xl mr-auto">
                    {orders
                      .filter(o => (activeOrderTab === 'TODOS' || o.status === activeOrderTab) && !deletedIds.includes(o.id))
                      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(order => (
                        <div key={order.id} onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)} className={`rounded-3xl overflow-hidden transition-all shadow-sm flex flex-col md:flex-row cursor-pointer border-2 ${selectedOrderId === order.id ? 'bg-red-50 border-red-500 ring-4 ring-red-100 scale-[1.01] shadow-xl' : 'bg-white border-slate-200 hover:border-red-200 hover:shadow-lg'} ${order.status === 'NOVO' && selectedOrderId !== order.id ? 'border-l-8 border-l-blue-500' : ''}`}>
                          <div className="flex-1 p-8 flex flex-col justify-between">
                            <div className="space-y-4">
                               <div className="flex flex-wrap items-center gap-3">
                                 <span className="text-2xl font-black text-slate-800">#{order.id.substring(0,6)}</span>
                                 
                                 {/* SELOS DE PAGAMENTO */}
                                 {order.paymentMethod.toUpperCase().includes('MERCADO PAGO') ? (
                                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${order.status === 'AGUARDANDO PAGAMENTO' ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-red-50 border-red-500 text-red-600'}`}>
                                     {order.status === 'AGUARDANDO PAGAMENTO' ? '⌛ AGUARDANDO PIX' : `✅ ${order.paymentMethod.replace('Mercado Pago - ', 'MP ').replace('Mercado Pago', 'MP')} - OK`.toUpperCase()}
                                   </span>
                                 ) : (order.deliveryType === 'TABLE') ? (
                                   <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 bg-purple-50 border-purple-500 text-purple-600">
                                     {`🪑 MESA ${tables.find(t => t.id === order.tableId)?.number || '??'}`} - PAGAMENTO NO LOCAL
                                   </span>
                                 ) : (
                                   <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 bg-blue-50 border-blue-500 text-blue-600">
                                     {order.deliveryType === 'PICKUP' ? '🛍️ RETIRADA' : '🚚 ENTREGA'} - {order.paymentMethod.toUpperCase()}
                                   </span>
                                 )}

                                 <div className="relative z-10">
                                   <select value={order.status} onClick={(e) => e.stopPropagation()} onChange={(e) => { const newStatus = e.target.value as OrderStatus; onUpdateOrderStatus(order.id, newStatus); if (order.status === 'NOVO' && newStatus !== 'NOVO') stopAlarm(); }} className={`appearance-none cursor-pointer pl-4 pr-10 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-2 transition-all shadow-sm ${getStatusColorClass(order.status)}`}>
                                     <option value="AGUARDANDO PAGAMENTO" disabled={order.deliveryType === 'TABLE'}>Aguardando Pagamento</option>
                                     <option value="NOVO">Novo</option>
                                     <option value="PREPARANDO">Preparando</option>
                                     <option value="PRONTO PARA RETIRADA" disabled={order.deliveryType === 'TABLE'}>Pronto p/ Retirada</option>
                                     <option value="SAIU PARA ENTREGA" disabled={order.deliveryType === 'TABLE'}>Saiu p/ Entrega</option>
                                     <option value="FINALIZADO">Finalizado</option>
                                     <option value="CANCELADO">Cancelado</option>
                                   </select>
                                   <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-current opacity-60">
                                     <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                   </div>
                                 </div>
                               </div>
                               <div className="text-slate-500 text-sm font-bold flex flex-wrap items-center gap-2">
                                 📅 {new Date(order.createdAt).toLocaleDateString('pt-BR')} {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} 
                                 <span className="text-slate-300 mx-2">|</span> 
                                 👤 <span className="text-slate-700">{order.customerName}</span>
                                 {order.motoboyName && (
                                   <>
                                     <span className="text-slate-300 mx-2">|</span>
                                     <span className="text-red-600">🛵 {order.motoboyName}</span>
                                   </>
                                 )}
                               </div>
                               {order.deliveryType === 'DELIVERY' && <div className="text-xs font-medium text-slate-500 bg-slate-50 p-3 rounded-lg flex items-center gap-2"><span>📍</span> {order.customerAddress}</div>}
                            </div>
                            <div className="mt-6 pt-6 border-t border-slate-100">
                               <ul className="space-y-3">
                                {order.items.map((item, idx) => (
                                  <li key={idx} className="flex justify-between items-start text-sm">
                                    <div className="flex flex-col">
                                       <span className="font-black text-slate-700 uppercase leading-none">{item.quantity}x {item.name}</span>
                                       {item.selectedComplements?.map((c, ci) => (
                                         <span key={ci} className="text-[10px] text-red-600 font-bold ml-4 mt-1 block">+ {c.name}</span>
                                       ))}
                                    </div>
                                    <span className="text-slate-500 font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-between items-end">
                                 <div>
                                   <div className="text-xs font-bold text-slate-400 uppercase">{order.paymentMethod}</div>
                                   {order.deliveryFee > 0 && <div className="text-[10px] font-bold text-slate-400 uppercase">Frete: R$ {order.deliveryFee.toFixed(2)}</div>}
                                   {order.discountValue && order.discountValue > 0 && <div className="text-[10px] font-bold text-red-500 uppercase">Desc: - R$ {order.discountValue.toFixed(2)}</div>}
                                 </div>
                                 <div className="text-2xl font-black text-red-600">Total: R$ {order.total.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="w-full md:w-16 bg-slate-50 border-l border-slate-200 flex flex-col items-center justify-center gap-4 py-4">
                             <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${order.customerPhone.replace(/\D/g,'')}`, '_blank'); }} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-red-50 text-red-600 shadow-sm" title="WhatsApp">📞</button>
                             <button onClick={(e) => { e.stopPropagation(); handlePrintOrder(order); }} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 shadow-sm" title="Imprimir Cupom">🖨️</button>
                             <button onClick={(e) => { e.stopPropagation(); requestDelete('ORDER', order.id, `Pedido #${order.id.substring(0,6)}`); }} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-red-50 text-red-500 shadow-sm" title="Excluir">🗑️</button>
                          </div>
                        </div>
                      ))}
                 </div>
              </div>
            )}

            {activeView === 'produtos' && (
              <div className="space-y-8 animate-in fade-in">
                <div ref={formTopRef}></div>
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                   <div className="flex justify-between items-center">
                     <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">{editingId ? '✏️ Editando Produto' : '✨ Novo Produto'}</h3>
                     {editingId && <button onClick={() => { setEditingId(null); setNewProduct({ name: '', price: 0, category: '', subCategory: '', description: '', image: '', rating: 5.0 }); }} className="text-red-500 text-sm font-bold uppercase hover:underline">Cancelar Edição</button>}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     <div className="space-y-2">
                        <label className={labelClass}>Nome do Produto</label>
                        <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Ex: X-Tudo" className={inputClass} />
                     </div>
                     <div className="space-y-2">
                        <label className={labelClass}>Preço (R$)</label>
                        <input type="number" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} placeholder="0.00" className={inputClass} />
                     </div>
                     <div className="space-y-2">
                        <label className={labelClass}>Categoria</label>
                        <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value, subCategory: ''})} className={inputClass}>
                          <option value="">Selecione...</option>
                          {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className={labelClass}>Subcategoria</label>
                        <select 
                          value={newProduct.subCategory || ''} 
                          onChange={e => setNewProduct({...newProduct, subCategory: e.target.value})} 
                          className={inputClass}
                          disabled={!newProduct.category}
                        >
                          <option value="">Selecione...</option>
                          {[...filteredSubCategories].sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                     </div>
                     <div className="md:col-span-2 lg:col-span-4 space-y-2">
                        <label className={labelClass}>Descrição Detalhada</label>
                        <textarea rows={3} value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className={inputClass} />
                     </div>
                     <div className="md:col-span-2 lg:col-span-4 space-y-2">
                        <label className={labelClass}>Imagem do Produto (Upload)</label>
                        <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 hover:border-red-400">
                          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], false)} className="text-sm text-slate-500 file:mr-5 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-red-100 file:text-red-700 cursor-pointer" />
                          {isProcessingImg && <span className="text-sm text-amber-500 font-bold animate-pulse">Processando...</span>}
                          {newProduct.image && <img src={newProduct.image} className="w-24 h-24 rounded-xl object-cover border-2 border-white shadow-md" referrerPolicy="no-referrer" />}
                        </div>
                     </div>
                   </div>
                   <div className="flex justify-end pt-6 border-t border-slate-100">
                     <button onClick={handleSaveProduct} className={`px-10 py-5 rounded-xl text-sm font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${editingId ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-red-600 text-white shadow-red-200'}`}>{editingId ? '💾 Atualizar Produto' : '🚀 Adicionar Produto'}</button>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {[...products].sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                     <div key={p.id} className={`bg-white p-5 rounded-3xl border flex gap-5 transition-all ${editingId === p.id ? 'border-blue-500 ring-4 ring-blue-50 shadow-xl' : 'border-slate-200 shadow-sm hover:shadow-lg'}`}>
                        <div className="w-24 h-24 bg-slate-50 rounded-2xl overflow-hidden shrink-0 border border-slate-100"><img src={p.image || logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                           <div>
                             <h4 className="font-black text-slate-800 truncate text-base">{p.name}</h4>
                             <p className="text-red-600 text-sm font-black mt-1">R$ {p.price.toFixed(2)}</p>
                              {p.outOfStock ? <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full block w-max mt-1">🔴 Sem Estoque</span> : <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full block w-max mt-1">🟢 Em Estoque</span>}
                             {p.subCategory && <span className="text-[10px] text-slate-400 font-bold uppercase">{p.subCategory}</span>}
                           </div>
                           <div className="flex gap-3 mt-4 justify-end">
                             <button 
                                onClick={async () => {
                                  onUpdateProduct({ ...p, outOfStock: !p.outOfStock });
                                }} 
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors ${p.outOfStock ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                              >
                                {p.outOfStock ? 'Ativar Est.' : 'Zerar Est.'}
                              </button>
                              <button onClick={() => handleEditProductClick(p)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">Editar</button>
                             <button onClick={() => requestDelete('PRODUCT', p.id, p.name)} className="px-4 py-2 bg-red-50 text-red-500 rounded-lg text-[10px] font-black uppercase">Excluir</button>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {activeView === 'categorias' && (
               <div className="space-y-8 animate-in fade-in">
                 <div ref={formTopRef}></div>
                 <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex gap-4 items-center">
                   <div className="flex-1">
                      <label className={labelClass}>{editingCatId ? 'Editando Categoria' : 'Nova Categoria'}</label>
                      <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Lanches" className={inputClass} />
                   </div>
                   <div className="flex flex-col gap-2 mt-6">
                     <button onClick={handleSaveCategory} className={editingCatId ? editButtonClass : buttonClass}>{editingCatId ? 'Atualizar' : 'Adicionar'}</button>
                     {editingCatId && <button onClick={() => { setEditingCatId(null); setCatName(''); }} className="text-slate-400 text-[10px] font-black uppercase">Cancelar</button>}
                   </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                     <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <span className="font-bold text-slate-700 uppercase text-sm">{c.name}</span>
                        <div className="flex gap-2">
                           <button onClick={() => handleEditCategoryClick(c)} className="bg-blue-50 text-blue-600 text-xs font-black px-3 py-1.5 rounded-lg">Editar</button>
                           <button onClick={() => requestDelete('CATEGORY', c.id, c.name)} className="text-red-500 text-xs font-black hover:bg-red-50 px-3 py-1.5 rounded-lg">Excluir</button>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {activeView === 'subcategorias' && (
               <div className="space-y-8 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">{editingSubCatId ? '✏️ Editando Subcategoria' : '🌿 Nova Subcategoria'}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className={labelClass}>Nome da Subcategoria</label>
                           <input value={subCatName} onChange={e => setSubCatName(e.target.value)} placeholder="Ex: Artesanais, Combos" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Categoria Pai</label>
                           <select value={subCatParent} onChange={e => setSubCatParent(e.target.value)} className={inputClass}>
                              <option value="">Selecione...</option>
                              {[...categories].sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select>
                        </div>
                     </div>
                     <div className="flex justify-end pt-4">
                        <button onClick={handleSaveSubCategory} className={editingSubCatId ? editButtonClass : buttonClass}>{editingSubCatId ? 'Atualizar' : 'Adicionar'}</button>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {[...subCategories].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                       <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-700 uppercase text-sm block">{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-black uppercase">Pai: {categories.find(c => c.id === s.categoryId)?.name || 'N/A'}</span>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleEditSubCategoryClick(s)} className="bg-blue-50 text-blue-600 text-xs font-black px-3 py-1.5 rounded-lg">Editar</button>
                             <button onClick={() => requestDelete('SUBCATEGORY', s.id, s.name)} className="text-red-500 text-xs font-black hover:bg-red-50 px-3 py-1.5 rounded-lg">Excluir</button>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeView === 'adicionais' && (
               <div className="space-y-8 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">➕ Novo Adicional</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-1">
                           <label className={labelClass}>Nome do Adicional</label>
                           <input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Ex: Bacon, Cheddar" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Preço (+R$)</label>
                           <input type="number" value={compPrice || ''} onChange={e => setCompPrice(Number(e.target.value))} placeholder="0.00" className={inputClass} />
                        </div>
                        <button onClick={() => { onAddComplement(compName, compPrice, []); setCompName(''); setCompPrice(0); }} className={buttonClass}>Adicionar</button>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {[...complements].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                       <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-700 uppercase text-sm block">{c.name}</span>
                            <span className="text-[10px] text-red-600 font-black uppercase">+ R$ {c.price.toFixed(2)}</span>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => onToggleComplement(c.id)} className={`text-xs font-black px-3 py-1.5 rounded-lg ${c.active ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>{c.active ? 'Ativo' : 'Inativo'}</button>
                             <button onClick={() => requestDelete('COMPLEMENT', c.id, c.name)} className="text-red-500 text-xs font-black hover:bg-red-50 px-3 py-1.5 rounded-lg">Excluir</button>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeView === 'cupons' && (
               <div className="space-y-8 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">🏷️ Novo Cupom</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1">
                           <label className={labelClass}>Código do Cupom</label>
                           <input value={cpCode} onChange={e => setCpCode(e.target.value.toUpperCase())} placeholder="Ex: PROMO10" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Valor do Desconto</label>
                           <input type="number" value={cpDiscount || ''} onChange={e => setCpDiscount(Number(e.target.value))} placeholder="10" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Tipo</label>
                           <select value={cpType} onChange={e => setCpType(e.target.value as any)} className={inputClass}>
                              <option value="PERCENT">% Percentual</option>
                              <option value="FIXED">R$ Fixo</option>
                           </select>
                        </div>
                        <button onClick={() => { onAddCoupon(cpCode, cpDiscount, cpType); setCpCode(''); setCpDiscount(0); }} className={buttonClass}>Criar Cupom</button>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {coupons.map(c => (
                       <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-700 uppercase text-sm block">{c.code}</span>
                            <span className="text-[10px] text-red-600 font-black uppercase">Desconto: {c.type === 'PERCENT' ? `${c.discount}%` : `R$ ${c.discount.toFixed(2)}`}</span>
                          </div>
                          <button onClick={() => requestDelete('COUPON', c.id, c.code)} className="text-red-500 text-xs font-black hover:bg-red-50 px-3 py-1.5 rounded-lg">Excluir</button>
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeView === 'entregas' && (
               <div className="space-y-8 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">🚚 Configurar Taxa de Frete</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1">
                           <label className={labelClass}>CEP Inicial (Apenas números)</label>
                           <input value={zipStart} onChange={e => setZipStart(e.target.value)} placeholder="38000000" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>CEP Final (Apenas números)</label>
                           <input value={zipEnd} onChange={e => setZipEnd(e.target.value)} placeholder="38099999" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Taxa de Entrega (R$)</label>
                           <input type="number" value={zipFee || ''} onChange={e => setZipFee(Number(e.target.value))} placeholder="5.00" className={inputClass} />
                        </div>
                        <button onClick={() => { onAddZipRange(zipStart, zipEnd, zipFee); setZipStart(''); setZipEnd(''); setZipFee(0); }} className={buttonClass}>Salvar Faixa</button>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                     {zipRanges.map(z => (
                       <div key={z.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-1">
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faixa de CEP</p>
                              <p className="font-bold text-slate-700 text-sm">{z.start} - {z.end}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Taxa Cobrada</p>
                              <p className="font-black text-red-600 text-sm">R$ {z.fee.toFixed(2)}</p>
                            </div>
                          </div>
                          <button onClick={() => requestDelete('ZIP', z.id, `${z.start}-${z.end}`)} className="text-red-500 text-xs font-black hover:bg-red-50 px-4 py-2 rounded-lg">Excluir</button>
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeView === 'clientes' && (
               <div className="space-y-8 animate-in fade-in">
                  <div className="grid grid-cols-1 gap-4">
                     {customers.map(c => (
                       <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                          <div className="flex-1 space-y-2">
                             <div className="flex items-center gap-3">
                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">{c.name}</h4>
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${c.isBlocked ? 'bg-red-100 text-red-600' : 'bg-red-100 text-red-600'}`}>
                                  {c.isBlocked ? 'BLOQUEADO' : 'ATIVO'}
                                </span>
                             </div>
                             <div className="text-xs font-bold text-slate-500 flex flex-wrap gap-x-6 gap-y-1">
                                <span>📧 {c.email}</span>
                                <span>📞 {c.phone}</span>
                                <span>📍 {c.neighborhood}</span>
                                <span>🛍️ {c.totalOrders} pedidos</span>
                             </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                             <button onClick={() => onUpdateCustomer(c.id, { isBlocked: !c.isBlocked })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${c.isBlocked ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                {c.isBlocked ? 'Desbloquear' : 'Bloquear'}
                             </button>
                             <button onClick={() => window.open(`https://wa.me/${c.phone.replace(/\D/g,'')}`, '_blank')} className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">WhatsApp</button>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeView === 'pagamentos' && (
               <div className="space-y-8 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Adicionar Novo Método na Lista</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-1">
                           <label className={labelClass}>Nome do Método</label>
                           <input value={payName} onChange={e => setPayName(e.target.value)} placeholder="Ex: Pix Online, Mercado Pago" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Tipo</label>
                           <select value={payType} onChange={e => setPayType(e.target.value as any)} className={inputClass}>
                             <option value="DELIVERY">Pagamento na Entrega</option>
                             <option value="ONLINE">Pagamento Online (App)</option>
                           </select>
                        </div>
                     </div>
                     <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button 
                          onClick={() => { 
                            if (!payName) return alert('Digite um nome para o método (Ex: Pix, Dinheiro, Cartão)');
                            onAddPaymentMethod(payName, payType); 
                            setPayName(''); 
                          }} 
                          className="w-full md:w-auto bg-red-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-700 shadow-xl shadow-red-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <span>➕</span> Salvar Novo Método de Pagamento
                        </button>
                     </div>
                  </div>
                         {/* CONFIGURAÇÃO MERCADO PAGO */}
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 border-l-8 border-l-blue-500">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl">💳</span>
                       Configuração Mercado Pago
                     </h3>
                     <div className="space-y-4">
                        <div className="space-y-1">
                           <label className={labelClass}>Access Token (Produção ou Teste)</label>
                           <input 
                             type="password" 
                             value={localMercadoPagoToken} 
                             onChange={e => setLocalMercadoPagoToken(e.target.value)} 
                             placeholder="APP_USR-..." 
                             className={`${inputClass} ${localMercadoPagoToken && !localMercadoPagoToken.startsWith('APP_USR-') && !localMercadoPagoToken.startsWith('TEST-') ? 'border-amber-500 focus:border-amber-500 bg-amber-50' : ''}`} 
                           />
                           {localMercadoPagoToken && !localMercadoPagoToken.startsWith('APP_USR-') && !localMercadoPagoToken.startsWith('TEST-') && (
                             <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-1">⚠️ O token deve começar com APP_USR- (Produção) ou TEST- (Teste)</p>
                           )}
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Credencial principal para processar pagamentos.</p>
                           <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-2">ℹ️ Dica: Adicione um método chamado "Mercado Pago" (Tipo: ONLINE) na lista abaixo para que apareça no checkout.</p>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={() => {
                                    console.log("[Admin] Salvando token MP:", localMercadoPagoToken ? "Presente" : "Vazio");
                                    onUpdatePaymentConfig({ 
                                        mercadopagoAccessToken: localMercadoPagoToken
                                    });
                                    alert("Configurações do Mercado Pago salvas com sucesso!");
                                }}
                                className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 w-full sm:w-auto"
                            >
                                💾 Salvar Configurações MP
                            </button>
                        </div>
                     </div>
                  </div>

                  {/* CONFIGURAÇÃO PAGSEGURO */}
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 border-l-8 border-l-red-500">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center text-xl">💳</span>
                       Configuração PagSeguro
                     </h3>
                     <div className="space-y-4">
                        <div className="space-y-1">
                           <label className={labelClass}>Email do PagSeguro</label>
                           <input 
                             type="email" 
                             value={localPagSeguroEmail} 
                             onChange={e => setLocalPagSeguroEmail(e.target.value)} 
                             placeholder="seuemail@exemplo.com" 
                             className={inputClass} 
                           />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Token do PagSeguro</label>
                           <input 
                             type="password" 
                             value={localPagSeguroToken} 
                             onChange={e => setLocalPagSeguroToken(e.target.value)} 
                             placeholder="Token gerado no painel do PagSeguro" 
                             className={inputClass} 
                           />
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gere o token em: Minha Conta &gt; Preferências &gt; Integrações.</p>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={() => {
                                    onUpdatePaymentConfig({ 
                                        pagseguroEmail: localPagSeguroEmail,
                                        pagseguroToken: localPagSeguroToken
                                    });
                                    alert("Configurações do PagSeguro salvas com sucesso!");
                                }}
                                className="bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 w-full sm:w-auto"
                            >
                                💾 Salvar Configurações PagSeguro
                            </button>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                     {paymentSettings.map(p => (
                       <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                          <div className="flex justify-between items-center">
                             <div>
                               <p className="font-black text-slate-800 text-lg uppercase">{p.name}</p>
                               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{p.type === 'ONLINE' ? '✨ Pagamento Online' : '🚚 Na Entrega'}</p>
                             </div>
                             <div className="flex gap-3 items-center">
                                <button onClick={() => onTogglePaymentMethod(p.id)} className={`text-xs font-black px-4 py-2 rounded-xl transition-all ${p.enabled ? 'text-red-600 bg-red-50 border border-red-200' : 'text-slate-400 bg-slate-100 border border-slate-200'}`}>
                                  {p.enabled ? 'ATIVADO' : 'DESATIVADO'}
                                </button>
                                <button onClick={() => requestDelete('PAYMENT', p.id, p.name)} className="text-red-500 text-xs font-black hover:bg-red-50 p-2 rounded-lg">🗑️</button>
                             </div>
                          </div>
                          {p.type === 'ONLINE' && (
                            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                               <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Integração</label>
                                  <select 
                                    value={p.integration || 'NONE'} 
                                    onChange={e => onUpdatePaymentSettings?.(p.id, { integration: e.target.value as any })} 
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-red-500"
                                  >
                                    <option value="NONE">Nenhuma (Manual)</option>
                                    <option value="MERCADO_PAGO">Mercado Pago</option>
                                    <option value="PAGSEGURO">PagSeguro</option>
                                  </select>
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail (Opcional)</label>
                                  <input 
                                    value={p.email || ''} 
                                    onChange={e => onUpdatePaymentSettings?.(p.id, { email: e.target.value })} 
                                    placeholder="email@exemplo.com" 
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                                  />
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Token / Chave (Opcional)</label>
                                  <input 
                                    type="password"
                                    value={p.token || ''} 
                                    onChange={e => onUpdatePaymentSettings?.(p.id, { token: e.target.value })} 
                                    placeholder="Token ou Chave Pix" 
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                                  />
                               </div>
                            </div>
                          )}
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeView === 'mesas' && (
               <div className="max-w-4xl space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-20">
                  <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center text-xl">🪑</span>
                       {editingTableId ? 'Editar Mesa' : 'Nova Mesa'}
                     </h3>
                     <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 space-y-1">
                           <label className={labelClass}>Número ou Nome da Mesa</label>
                           <input 
                             value={tableName} 
                             onChange={e => setTableName(e.target.value)} 
                             placeholder="Ex: Mesa 01, Balcão 05" 
                             className={inputClass} 
                           />
                        </div>
                        <div className="flex items-end gap-3">
                           <button onClick={handleSaveTable} className={buttonClass}>
                             {editingTableId ? '💾 Atualizar' : '➕ Adicionar'}
                           </button>
                           {editingTableId && (
                             <button onClick={() => { setEditingTableId(null); setTableName(''); }} className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-slate-200 transition-all">
                               Cancelar
                             </button>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                     {tables.map(t => (
                       <div key={t.id} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3 relative group ${
                          t.status === 'OCCUPIED' ? 'bg-red-50 border-red-200 text-red-700' : 
                          t.status === 'RESERVED' ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                          t.status === 'IN_SERVICE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                        }`}>
                          <span className="text-3xl">🪑</span>
                          <span className="font-black text-sm uppercase tracking-tighter text-center">{t.number}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                             t.status === 'OCCUPIED' ? 'bg-red-100' : 
                             t.status === 'RESERVED' ? 'bg-amber-100' : 
                             t.status === 'IN_SERVICE' ? 'bg-emerald-100' :
                             'bg-red-100 text-red-700'
                           }`}>
                            {t.status === 'OCCUPIED' ? 'Ocupada' : t.status === 'RESERVED' ? 'Reservada' : t.status === 'IN_SERVICE' ? 'No Pedido' : 'Livre'}
                          </span>
                          
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/mesa/' + t.id)}`, '_blank')} className="p-1.5 bg-white shadow-sm rounded-lg text-red-600 hover:bg-red-50" title="Ver QR Code">📱</button>
                             <button onClick={() => handleEditTableClick(t)} className="p-1.5 bg-white shadow-sm rounded-lg text-blue-500 hover:bg-blue-50" title="Editar">✏️</button>
                             <button onClick={() => requestDelete('TABLE', t.id, t.number)} className="p-1.5 bg-white shadow-sm rounded-lg text-red-500 hover:bg-red-50" title="Excluir">🗑️</button>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeView === 'ajustes' && (
               <div className="max-w-4xl space-y-12 animate-in slide-in-from-bottom-5 duration-500 pb-20">
                  <section className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center text-xl">🏢</span>
                       Configurações Gerais
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        <div className="space-y-3">
                           <label className={labelClass}>Status da Loja</label>
                           <button onClick={onToggleStore} className={`w-full py-8 rounded-2xl flex items-center justify-center gap-4 border-2 transition-all ${isStoreOpen ? 'bg-emerald-50 border-emerald-500 text-emerald-600 font-black ring-4 ring-emerald-100' : 'bg-red-50 border-red-200 text-red-500 hover:bg-slate-100 hover:border-red-300'}`}>
                              <div className={`w-3 h-3 rounded-full ${isStoreOpen ? 'bg-emerald-500 animate-pulse shadow-lg' : 'bg-red-500'}`}></div>
                              <span className="font-black text-lg uppercase tracking-widest">{isStoreOpen ? 'Loja Aberta' : 'Loja Fechada'}</span>
                           </button>
                        </div>
                        <div className="space-y-3">
                           <label className={labelClass}>Modo Manutenção</label>
                           <button 
                             onClick={onToggleMaintenance} 
                             className={`w-full py-8 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${isMaintenanceMode ? 'bg-amber-50 border-amber-500 text-amber-600 font-black ring-4 ring-amber-100 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400 font-bold hover:bg-slate-100 hover:border-slate-300'}`}
                           >
                              <div className="flex items-center gap-3">
                                 <span className="text-2xl">{isMaintenanceMode ? '🚧' : '🌐'}</span>
                                 <span className="font-black text-lg uppercase tracking-widest">{isMaintenanceMode ? 'Em Manutenção' : 'Site Online'}</span>
                              </div>
                           </button>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center leading-relaxed">
                              {isMaintenanceMode 
                               ? '⚠️ Clientes comuns verão aviso de manutenção, mas você como admin acessa normalmente.' 
                               : '✅ O site está visível ao público e recebendo pedidos normalmente.'}
                           </p>
                        </div>
                        <div className="space-y-3">
                           <label className={labelClass + " text-slate-400"}>Modo Quiosque (Totem) - Desativado</label>
                           <button onClick={onToggleKioskMode} disabled className={`w-full py-8 rounded-2xl flex items-center justify-center gap-4 border-2 transition-all bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none grayscale`}>
                              <span className="text-2xl">{isKioskMode ? '🤖' : '📱'}</span>
                              <span className="font-black text-lg uppercase tracking-widest">{isKioskMode ? 'Quiosque Ativado' : 'Modo Normal'}</span>
                           </button>
                        </div>
                        <div className="space-y-3 md:col-span-2 xl:col-span-3">
                           <label className={labelClass}>Paleta de Cores do Projeto</label>
                           <div className="flex flex-wrap gap-4 mt-2">
                             {[
                               { id: 'red', name: 'Vermelho', hex: '#ef4444' },
                               { id: 'blue', name: 'Azul', hex: '#3b82f6' },
                               { id: 'green', name: 'Verde', hex: '#22c55e' },
                               { id: 'orange', name: 'Laranja', hex: '#f97316' },
                               { id: 'purple', name: 'Roxo', hex: '#a855f7' },
                               { id: 'zinc', name: 'Escuro', hex: '#3f3f46' },
                             ].map(color => (
                               <button
                                 key={color.id}
                                 onClick={() => onUpdateThemeColor(color.id)}
                                 className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${themeColor === color.id ? 'border-slate-800 bg-slate-50 scale-105 shadow-md' : 'border-transparent hover:bg-slate-100'}`}
                               >
                                 <div className="w-12 h-12 rounded-full shadow-sm" style={{ backgroundColor: color.hex }}></div>
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{color.name}</span>
                               </button>
                             ))}
                           </div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                              Escolha a cor principal que será usada em botões, destaques e painéis em todo o aplicativo.
                           </p>
                        </div>
                        <div className="space-y-3 md:col-span-2">
                           <label className={labelClass}>Alerta Sonoro (Novos Pedidos)</label>
                           <div className="flex gap-3">
                              <button onClick={() => setAudioEnabled(!audioEnabled)} className={`flex-1 py-8 rounded-2xl flex items-center justify-center gap-4 border-2 transition-all ${audioEnabled ? 'bg-red-50 border-red-500 text-red-600' : 'bg-slate-50 border-slate-300 text-slate-400'}`}>
                                 <span className="text-2xl">{audioEnabled ? '🔊' : '🔇'}</span>
                                 <span className="font-black text-lg uppercase tracking-widest">{audioEnabled ? 'Ligado' : 'Desligado'}</span>
                              </button>
                              <button onClick={testAlarm} className="px-6 py-8 bg-white border-2 border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-600 transition-all font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-2">
                                 <span>🔔</span>
                                 <span>Testar</span>
                              </button>
                           </div>
                        </div>

                        <div className="space-y-3 md:col-span-2">
                           <label className={labelClass}>Nome da Loja</label>
                           <input type="text" value={storeName} onChange={(e) => onUpdateStoreName(e.target.value)} className={inputClass} placeholder="BERTIM" />
                        </div>

                        <div className="space-y-3 md:col-span-2">
                           <label className={labelClass}>Logo da Loja (Upload)</label>
                           <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 hover:border-red-400">
                              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], true)} className="text-sm text-slate-500 file:mr-5 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-red-100 file:text-red-700 cursor-pointer" />
                              {logoUrl && <img src={logoUrl} className="w-20 h-20 bg-white rounded-xl border border-slate-200 object-contain" referrerPolicy="no-referrer" />}
                           </div>
                        </div>
                     </div>
                  </section>

                  {/* IMPORTAÇÃO DE CLIENTES SQL */}
                  <section className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center text-xl">📥</span>
                       Importar Clientes (SQL)
                     </h3>
                     <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Selecione um arquivo .sql para importar seus clientes antigos.</p>
                        <input 
                          type="file" 
                          accept=".sql" 
                          onChange={handleImportSQL}
                          className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-slate-900 file:text-white cursor-pointer" 
                        />
                        {isImporting && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase animate-pulse">
                            {importLog}
                          </div>
                        )}
                     </div>
                  </section>
                  
                  <section className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center text-xl">🧹</span>
                        Manutenção
                      </h3>

                      {/* ATIVAÇÃO DO MODO MANUTENÇÃO */}
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4">
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">🚧 Modo Manutenção do Site</h4>
                         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <button 
                              onClick={onToggleMaintenance}
                              className={`px-8 py-5 rounded-2xl flex items-center justify-center gap-3 border-2 transition-all shrink-0 font-black uppercase tracking-widest text-sm ${isMaintenanceMode ? 'bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-200 animate-pulse' : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'}`}
                            >
                              <span>{isMaintenanceMode ? '🚧 Desativar Manutenção' : '🚧 Ativar Modo Manutenção'}</span>
                            </button>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                               {isMaintenanceMode 
                                ? '⚠️ Atenção: Os clientes comuns verão apenas um aviso amigável de manutenção. Você, como administrador, poderá navegar e testar a loja normalmente.' 
                                : '✅ O site está ativo no ar e recebendo pedidos normalmente.'}
                            </div>
                         </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100 space-y-4">
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">🛠️ Operações de Limpeza no Banco de Dados</h4>
                         <div className="flex flex-wrap gap-4">
                        <button
                           onClick={() => setShowMaintenanceConfirm(true)}
                           className="bg-red-600 text-white py-4 px-8 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all shadow-md active:scale-95 animate-in fade-in"
                        >
                          Remover Duplicados
                        </button>
                        <button
                           onClick={() => setShowZeroStockConfirm(true)}
                           className="bg-amber-500 text-white py-4 px-8 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-600 transition-all shadow-md active:scale-95 animate-in fade-in"
                        >
                          🚧 Zerar Estoque de Todos
                        </button>
                        <button
                           onClick={() => setShowRestoreStockConfirm(true)}
                           className="bg-emerald-600 text-white py-4 px-8 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95 animate-in fade-in"
                        >
                          🌐 Restaurar Estoque de Todos
                        </button>
                        <button
                           onClick={() => setShowDeleteAllProductsConfirm(true)}
                           className="bg-red-800 text-white py-4 px-8 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-900 transition-all shadow-md active:scale-95 animate-in fade-in"
                        >
                          🗑️ Deletar Todos os Produtos (Real)
                        </button>
                        <button
                           onClick={() => setShowDeleteAllComplementsConfirm(true)}
                           className="bg-rose-800 text-white py-4 px-8 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-900 transition-all shadow-md active:scale-95 animate-in fade-in"
                        >
                          🗑️ Deletar Todos os Adicionais (Real)
                         </button>
                      </div>
                      </div>
                      {showMaintenanceConfirm && (
                        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                             <h3 className="text-xl font-black text-slate-800 mb-4">Confirmar Exclusão</h3>
                             <p className="text-slate-600 mb-8 font-medium text-sm">Tem certeza que deseja excluir todos os produtos duplicados?</p>
                             <div className="flex gap-4">
                                <button onClick={() => setShowMaintenanceConfirm(false)} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                                <button onClick={async () => {
                                   setShowMaintenanceConfirm(false);
                                   
                                   try {
                                     const firestoreDb = dbService.getDb();
                                     if (!firestoreDb) {
                                       throw new Error("Conexão com o banco de dados não disponível.");
                                     }

                                     setOperationProgress({
                                       active: true,
                                       label: "Analisando duplicados no banco...",
                                       current: 0,
                                       total: 100,
                                       percentage: 0
                                     });

                                     // Duplicate Products
                                     const allProducts = await dbService.getAll<any>('products');
                                     const seenProducts = new Set();
                                     const duplicateProducts = [];

                                     for (const p of allProducts) {
                                        if (p && p.name) {
                                           const normalizedName = p.name.trim().toLowerCase();
                                           if (seenProducts.has(normalizedName)) {
                                              duplicateProducts.push(p);
                                           } else {
                                              seenProducts.add(normalizedName);
                                           }
                                        }
                                     }

                                     // Duplicate Complements
                                     const allComplements = await dbService.getAll<any>('complements');
                                     const seenComplements = new Set();
                                     const duplicateComplements = [];

                                     for (const p of allComplements) {
                                        if (p && p.name) {
                                           const normalizedName = p.name.trim().toLowerCase();
                                           if (seenComplements.has(normalizedName)) {
                                              duplicateComplements.push(p);
                                           } else {
                                              seenComplements.add(normalizedName);
                                           }
                                        }
                                     }

                                     const totalToDelete = duplicateProducts.length + duplicateComplements.length;
                                     
                                     if (totalToDelete === 0) {
                                        setOperationProgress(null);
                                        alert("Nenhum item duplicado encontrado para remover.");
                                        return;
                                     }

                                     let currentProcessed = 0;
                                     setOperationProgress({
                                       active: true,
                                       label: `Removendo ${totalToDelete} itens duplicados...`,
                                       current: 0,
                                       total: totalToDelete,
                                       percentage: 0
                                     });

                                     // Create flat list of deletes
                                     const itemsToDelete = [
                                       ...duplicateProducts.map(p => ({ collection: 'products', id: p.id })),
                                       ...duplicateComplements.map(c => ({ collection: 'complements', id: c.id }))
                                     ];

                                     const chunkSize = 200;
                                     for (let i = 0; i < itemsToDelete.length; i += chunkSize) {
                                       const chunk = itemsToDelete.slice(i, i + chunkSize);
                                       const batch = writeBatch(firestoreDb);
                                       
                                       for (const item of chunk) {
                                         const docRef = doc(firestoreDb, item.collection, item.id);
                                         batch.delete(docRef);
                                       }
                                       
                                       await batch.commit();
                                       currentProcessed += chunk.length;
                                       setOperationProgress({
                                         active: true,
                                         label: `Removendo ${totalToDelete} itens duplicados...`,
                                         current: currentProcessed,
                                         total: totalToDelete,
                                         percentage: Math.round((currentProcessed / totalToDelete) * 100)
                                       });
                                     }

                                     setOperationProgress(null);
                                     alert(`Foram removidos ${totalToDelete} itens duplicados com sucesso! (${duplicateProducts.length} produtos e ${duplicateComplements.length} adicionais).`);
                                     window.location.reload();
                                   } catch (err: any) {
                                     console.error("Erro ao remover duplicados:", err);
                                     setOperationProgress(null);
                                     alert("Erro ao remover duplicados: " + (err?.message || err));
                                   }
                                }} className="flex-1 px-6 py-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700">Confirmar</button>
                             </div>
                          </div>
                      </div>
                      )}
                      
                  </section>

                  {operationProgress && operationProgress.active && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                      <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center space-y-6">
                          
                          {/* Spinner with counter */}
                          <div className="relative w-20 h-20 flex items-center justify-center">
                            <svg className="absolute w-full h-full transform -rotate-90">
                              <circle
                                cx="40"
                                cy="40"
                                r="34"
                                stroke="#f1f5f9"
                                strokeWidth="6"
                                fill="transparent"
                              />
                              <circle
                                cx="40"
                                cy="40"
                                r="34"
                                stroke="#ef4444"
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 34}
                                strokeDashoffset={2 * Math.PI * 34 * (1 - operationProgress.percentage / 100)}
                                className="transition-all duration-300 ease-out"
                              />
                            </svg>
                            <span className="text-xl font-mono font-black text-slate-800">{operationProgress.percentage}%</span>
                          </div>

                          <div className="space-y-2 w-full">
                            <h3 className="text-lg font-black text-slate-800 tracking-wider uppercase">
                              ⚙️ Processando Informações
                            </h3>
                            <p className="text-sm font-bold text-slate-500 leading-relaxed min-h-[40px] px-2">
                              {operationProgress.label}
                            </p>
                          </div>

                          {/* Linear progress fill bar */}
                          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner p-0.5">
                            <div 
                              className="bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2 text-[9px] font-black text-white font-mono"
                              style={{ width: `${Math.max(operationProgress.percentage, 8)}%` }}
                            >
                              {operationProgress.percentage >= 15 && `${operationProgress.percentage}%`}
                            </div>
                          </div>

                          {/* Counts info */}
                          <div className="flex justify-between w-full text-[10px] font-black text-slate-400 font-mono px-1">
                            <span>STATUS: EXECUTANDO</span>
                            <span>{operationProgress.current} / {operationProgress.total}</span>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {showZeroStockConfirm && (
                    <div className="fixed inset-0 bg-slate-900/50 z-[110] flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 mb-4">⚠️ Zerar Todo o Estoque?</h3>
                        <p className="text-slate-600 mb-8 font-medium text-sm">Tem certeza de que deseja marcar todos os produtos como **Sem Estoque** (Esgotado) temporariamente? Os clientes não conseguirão adicioná-los ao carrinho.</p>
                        <div className="flex gap-4">
                          <button onClick={() => setShowZeroStockConfirm(false)} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                          <button
                            onClick={async () => {
                              setShowZeroStockConfirm(false);
                              try {
                                const firestoreDb = dbService.getDb();
                                if (!firestoreDb) {
                                  throw new Error("Conexão com o banco de dados não disponível.");
                                }
                                const targetProducts = (products || []).filter(p => p && p.id);
                                if (targetProducts.length === 0) {
                                  alert('Nenhum produto cadastrado para alterar.');
                                  return;
                                }

                                setOperationProgress({
                                  active: true,
                                  label: "Analisando produtos e preparando lote...",
                                  current: 0,
                                  total: targetProducts.length,
                                  percentage: 0
                                });

                                let currentProcessed = 0;
                                const chunkSize = 200;
                                for (let i = 0; i < targetProducts.length; i += chunkSize) {
                                  const chunk = targetProducts.slice(i, i + chunkSize);
                                  const batch = writeBatch(firestoreDb);
                                  for (const p of chunk) {
                                    const docRef = doc(firestoreDb, 'products', p.id);
                                    batch.set(docRef, { outOfStock: true }, { merge: true });
                                  }
                                  await batch.commit();
                                  currentProcessed += chunk.length;
                                  setOperationProgress({
                                    active: true,
                                    label: `Zerando estoque de ${targetProducts.length} produtos...`,
                                    current: currentProcessed,
                                    total: targetProducts.length,
                                    percentage: Math.round((currentProcessed / targetProducts.length) * 100)
                                  });
                                }
                                setOperationProgress(null);
                                alert('Todo o estoque foi zerado com sucesso!');
                              } catch (err: any) {
                                console.error('Erro ao zerar estoque:', err);
                                setOperationProgress(null);
                                alert('Erro ao zerar o estoque: ' + (err?.message || err));
                              }
                            }}
                            className="flex-1 px-6 py-4 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg shadow-amber-200 uppercase text-xs"
                          >
                            Sim, Zerar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showRestoreStockConfirm && (
                    <div className="fixed inset-0 bg-slate-900/50 z-[110] flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 mb-4">🌐 Restaurar Todo o Estoque?</h3>
                        <p className="text-slate-600 mb-8 font-medium text-sm">Tem certeza de que deseja marcar todos os produtos como **Em Estoque** (Disponível)? Os clientes poderão comprá-los normalmente.</p>
                        <div className="flex gap-4">
                          <button onClick={() => setShowRestoreStockConfirm(false)} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                          <button
                            onClick={async () => {
                              setShowRestoreStockConfirm(false);
                              try {
                                const firestoreDb = dbService.getDb();
                                if (!firestoreDb) {
                                  throw new Error("Conexão com o banco de dados não disponível.");
                                }
                                const targetProducts = (products || []).filter(p => p && p.id);
                                if (targetProducts.length === 0) {
                                  alert('Nenhum produto cadastrado para alterar.');
                                  return;
                                }

                                setOperationProgress({
                                  active: true,
                                  label: "Analisando produtos e preparando lote...",
                                  current: 0,
                                  total: targetProducts.length,
                                  percentage: 0
                                });

                                let currentProcessed = 0;
                                const chunkSize = 200;
                                for (let i = 0; i < targetProducts.length; i += chunkSize) {
                                  const chunk = targetProducts.slice(i, i + chunkSize);
                                  const batch = writeBatch(firestoreDb);
                                  for (const p of chunk) {
                                    const docRef = doc(firestoreDb, 'products', p.id);
                                    batch.set(docRef, { outOfStock: false }, { merge: true });
                                  }
                                  await batch.commit();
                                  currentProcessed += chunk.length;
                                  setOperationProgress({
                                    active: true,
                                    label: `Restaurando estoque de ${targetProducts.length} produtos...`,
                                    current: currentProcessed,
                                    total: targetProducts.length,
                                    percentage: Math.round((currentProcessed / targetProducts.length) * 100)
                                  });
                                }
                                setOperationProgress(null);
                                alert('Todo o estoque foi restaurado com sucesso!');
                              } catch (err: any) {
                                console.error('Erro ao restaurar estoque:', err);
                                setOperationProgress(null);
                                alert('Erro ao restaurar o estoque: ' + (err?.message || err));
                              }
                            }}
                            className="flex-1 px-6 py-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 uppercase text-xs"
                          >
                            Sim, Restaurar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showDeleteAllProductsConfirm && (
                    <div className="fixed inset-0 bg-slate-900/50 z-[110] flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 mb-4">🚨 DELETAR TODOS OS PRODUTOS?</h3>
                        <p className="text-slate-600 mb-8 font-medium text-sm text-center">
                          Esta ação é <strong>IRREVERSÍVEL</strong> e deletará <strong className="text-red-600">todos os produtos fisicamente</strong> do banco de dados! 
                          <br/><br/>
                          Isso limpará os produtos para que você possa fazer uma importação limpa do zero.
                        </p>
                        <div className="flex gap-4">
                          <button onClick={() => setShowDeleteAllProductsConfirm(false)} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                          <button
                            onClick={async () => {
                              setShowDeleteAllProductsConfirm(false);
                              try {
                                const firestoreDb = dbService.getDb();
                                if (!firestoreDb) {
                                  throw new Error("Conexão com o banco de dados não disponível.");
                                }

                                const allProducts = await dbService.getAll<any>('products');
                                if (allProducts.length === 0) {
                                  alert('Nenhum produto cadastrado para excluir.');
                                  return;
                                }

                                setOperationProgress({
                                  active: true,
                                  label: "Analisando produtos e preparando lote...",
                                  current: 0,
                                  total: allProducts.length,
                                  percentage: 0
                                });

                                let currentProcessed = 0;
                                const chunkSize = 200;
                                for (let i = 0; i < allProducts.length; i += chunkSize) {
                                  const chunk = allProducts.slice(i, i + chunkSize);
                                  const batch = writeBatch(firestoreDb);
                                  for (const p of chunk) {
                                    const docRef = doc(firestoreDb, 'products', p.id);
                                    batch.delete(docRef);
                                  }
                                  await batch.commit();
                                  currentProcessed += chunk.length;
                                  setOperationProgress({
                                    active: true,
                                    label: `Excluindo permanentemente ${allProducts.length} produtos...`,
                                    current: currentProcessed,
                                    total: allProducts.length,
                                    percentage: Math.round((currentProcessed / allProducts.length) * 100)
                                  });
                                }
                                
                                try {
                                  localStorage.removeItem('menu_populated');
                                } catch (e) {
                                  console.warn("Storage error:", e);
                                }

                                setOperationProgress(null);
                                alert('Todos os produtos foram deletados com sucesso!');
                              } catch (err: any) {
                                console.error('Erro ao deletar produtos:', err);
                                setOperationProgress(null);
                                alert('Erro ao deletar produtos: ' + (err?.message || err));
                              }
                            }}
                            className="flex-1 px-6 py-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200 uppercase text-xs"
                          >
                            Sim, Deletar Tudo
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showDeleteAllComplementsConfirm && (
                    <div className="fixed inset-0 bg-slate-900/50 z-[110] flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 mb-4">🚨 DELETAR TODOS OS ADICIONAIS?</h3>
                        <p className="text-slate-600 mb-8 font-medium text-sm text-center">
                          Esta ação é <strong>IRREVERSÍVEL</strong> e deletará <strong className="text-purple-600">todos os adicionais/complementos fisicamente</strong> do banco de dados!
                          <br/><br/>
                          Isso limpará os adicionais para que você possa fazer uma importação limpa do zero.
                        </p>
                        <div className="flex gap-4">
                          <button onClick={() => setShowDeleteAllComplementsConfirm(false)} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                          <button
                            onClick={async () => {
                              setShowDeleteAllComplementsConfirm(false);
                              try {
                                const firestoreDb = dbService.getDb();
                                if (!firestoreDb) {
                                  throw new Error("Conexão com o banco de dados não disponível.");
                                }

                                const allComplements = await dbService.getAll<any>('complements');
                                if (allComplements.length === 0) {
                                  alert('Nenhum adicional cadastrado para excluir.');
                                  return;
                                }

                                setOperationProgress({
                                  active: true,
                                  label: "Analisando adicionais e preparando lote...",
                                  current: 0,
                                  total: allComplements.length,
                                  percentage: 0
                                });

                                let currentProcessed = 0;
                                const chunkSize = 200;
                                for (let i = 0; i < allComplements.length; i += chunkSize) {
                                  const chunk = allComplements.slice(i, i + chunkSize);
                                  const batch = writeBatch(firestoreDb);
                                  for (const c of chunk) {
                                    const docRef = doc(firestoreDb, 'complements', c.id);
                                    batch.delete(docRef);
                                  }
                                  await batch.commit();
                                  currentProcessed += chunk.length;
                                  setOperationProgress({
                                    active: true,
                                    label: `Excluindo permanentemente ${allComplements.length} adicionais...`,
                                    current: currentProcessed,
                                    total: allComplements.length,
                                    percentage: Math.round((currentProcessed / allComplements.length) * 100)
                                  });
                                }

                                try {
                                  localStorage.removeItem('complements_populated');
                                } catch (e) {
                                  console.warn("Storage error:", e);
                                }

                                setOperationProgress(null);
                                alert('Todos os adicionais foram deletados com sucesso!');
                              } catch (err: any) {
                                console.error('Erro ao deletar adicionais:', err);
                                setOperationProgress(null);
                                alert('Erro ao deletar adicionais: ' + (err?.message || err));
                              }
                            }}
                            className="flex-1 px-6 py-4 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-lg shadow-purple-200 uppercase text-xs"
                          >
                            Sim, Deletar Tudo
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SEÇÃO DE SEGURANÇA E ACESSOS */}
                  <section className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center text-xl">🔒</span>
                       Segurança e Acessos
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                           <label className={labelClass}>Usuário Administrativo</label>
                           <input value={localAdminUser} onChange={e => setLocalAdminUser(e.target.value)} placeholder="admin" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Senha Administrativa</label>
                           <input type="password" value={localAdminPass} onChange={e => setLocalAdminPass(e.target.value)} placeholder="••••••••" className={inputClass} />
                        </div>
                        <div className="space-y-1 opacity-30 grayscale pointer-events-none cursor-not-allowed select-none">
                           <label className={labelClass}>Senha Portal Entregador</label>
                           <input type="password" value={localMotoboyPass} onChange={e => setLocalMotoboyPass(e.target.value)} placeholder="••••••••" className={inputClass} disabled />
                        </div>
                        <div className="space-y-1 opacity-30 grayscale pointer-events-none cursor-not-allowed select-none">
                           <label className={labelClass}>Senha Acesso Garçom</label>
                           <input type="password" value={localWaiterPass} onChange={e => setLocalWaiterPass(e.target.value)} placeholder="••••••••" className={inputClass} disabled />
                        </div>
                        <div className="flex items-end">
                           <button 
                             onClick={() => setShowPassConfirm(true)} 
                             className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all"
                           >
                             Salvar Alterações de Senha
                           </button>
                        </div>
                     </div>
                  </section>

                  <section className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xl">📱</span>
                       Informações da Loja & Redes Sociais
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                           <label className={labelClass}>Endereço da Loja</label>
                           <input value={localAddress} onChange={e => setLocalAddress(e.target.value)} onBlur={() => onUpdateSocialLinks({ ...socialLinks, address: localAddress })} placeholder="Rua Exemplo, 123 - Centro" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Cidade - Estado</label>
                           <input value={localCity} onChange={e => setLocalCity(e.target.value)} onBlur={() => onUpdateSocialLinks({ ...socialLinks, city: localCity })} placeholder="Uberaba - MG" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Instagram (URL completa)</label>
                           <input value={localInstagram} onChange={e => setLocalInstagram(e.target.value)} onBlur={() => onUpdateSocialLinks({ ...socialLinks, instagram: localInstagram })} placeholder="https://instagram.com/bertimpastelhotdog" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>WhatsApp (Número com DDD)</label>
                           <input value={localWhatsapp} onChange={e => setLocalWhatsapp(e.target.value)} onBlur={() => onUpdateSocialLinks({ ...socialLinks, whatsapp: localWhatsapp })} placeholder="5534991183728" className={inputClass} />
                        </div>
                        <div className="space-y-1">
                           <label className={labelClass}>Facebook (URL completa)</label>
                           <input value={localFacebook} onChange={e => setLocalFacebook(e.target.value)} onBlur={() => onUpdateSocialLinks({ ...socialLinks, facebook: localFacebook })} placeholder="https://facebook.com/bertimpastelhotdog" className={inputClass} />
                        </div>
                     </div>
                  </section>
               </div>
            )}
          </div>

          {activeView === 'pedidos' && (
             <aside className="w-64 bg-white border-l border-slate-200 p-6 overflow-y-auto hidden lg:flex flex-col gap-2 shrink-0 z-20 shadow-[-5px_0_20px_-10px_rgba(0,0,0,0.05)]">
               <div className={`text-xs font-black uppercase tracking-widest mb-4 border-b pb-2 ${selectedOrderId ? 'text-red-600 border-red-100' : 'text-slate-400 border-slate-100'}`}>
                  {selectedOrderId ? `DEFINIR STATUS DO PEDIDO` : 'FILTRAR POR STATUS'}
               </div>
               {ORDER_STATUSES.map(status => {
                 const selectedOrder = orders.find(o => o.id === selectedOrderId);
                 const isTableOrder = selectedOrder?.deliveryType === 'TABLE';
                 const isDisabled = selectedOrderId !== null && (
                   status === 'TODOS' || 
                   (isTableOrder && ['AGUARDANDO PAGAMENTO', 'PRONTO PARA RETIRADA', 'SAIU PARA ENTREGA'].includes(status))
                 );

                 return (
                   <button 
                     key={status} 
                     onClick={() => handleRightSidebarClick(status)} 
                     disabled={isDisabled} 
                     className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedOrderId ? (isDisabled ? 'opacity-20 cursor-not-allowed border-transparent' : 'bg-white border-slate-200 hover:bg-red-50 hover:border-red-500 hover:text-red-700 hover:scale-105 shadow-sm') : (activeOrderTab === status ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-200' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700')}`}
                   >
                     {status} 
                     {status !== 'TODOS' && !selectedOrderId && (
                       <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] ${activeOrderTab === status ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                         {orders.filter(o => o.status === status && !deletedIds.includes(o.id)).length}
                       </span>
                     )}
                   </button>
                 );
               })}
               {selectedOrderId && <button onClick={() => setSelectedOrderId(null)} className="mt-4 text-[9px] font-black uppercase text-red-400 hover:text-red-600">Cancelar Seleção X</button>}
             </aside>
          )}
        </div>
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white border border-slate-200 p-10 rounded-[40px] max-w-md w-full text-center space-y-8 shadow-2xl animate-in zoom-in-95">
              <div className="text-7xl">⚠️</div>
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Excluir {deleteTarget.type === 'ORDER' ? 'Pedido' : 'Item'}?</h3>
              <div className="flex flex-col gap-4">
                 <button onClick={confirmDelete} className="w-full py-6 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl transition-all active:scale-95">Confirmar Exclusão</button>
                 <button onClick={() => setDeleteTarget(null)} className="w-full py-4 text-slate-400 font-bold uppercase text-xs hover:text-slate-600">Cancelar</button>
              </div>
           </div>
        </div>
      )}

      {showPassConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white border border-slate-200 p-10 rounded-[40px] max-w-md w-full text-center space-y-8 shadow-2xl animate-in zoom-in-95">
              <div className="text-7xl">🔐</div>
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Confirmar Alteração?</h3>
              <p className="text-slate-500 text-sm font-bold">Você tem certeza que deseja alterar as senhas de acesso ao sistema?</p>
              <div className="flex flex-col gap-4">
                 <button onClick={handleConfirmPassSave} className="w-full py-6 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl transition-all active:scale-95">Sim, Salvar Senhas</button>
                 <button onClick={() => setShowPassConfirm(false)} className="w-full py-4 text-slate-400 font-bold uppercase text-xs hover:text-slate-600">Cancelar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; icon: string; label: string; onClick: () => void; badge?: number; disabled?: boolean }> = ({ active, icon, label, onClick, badge, disabled }) => (
  <button 
    onClick={disabled ? undefined : onClick} 
    disabled={disabled}
    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all group ${
      disabled 
        ? 'text-white cursor-not-allowed opacity-30 grayscale' 
        : active 
          ? 'bg-red-600 text-white shadow-xl shadow-red-900/20' 
          : 'text-white hover:bg-slate-800'
    }`}
  >
    <div className="flex items-center gap-4">
       <span className={`text-xl ${!disabled && 'group-hover:scale-110'} transition-transform`}>{icon}</span>
       <span className="font-black uppercase tracking-widest text-xs">{label}</span>
    </div>
    {badge !== undefined && <span className={`min-w-[24px] h-6 flex items-center justify-center rounded-full text-[10px] font-black px-2 ${active ? 'bg-white text-red-600' : 'bg-blue-600 text-white animate-pulse'}`}>{badge}</span>}
  </button>
);
