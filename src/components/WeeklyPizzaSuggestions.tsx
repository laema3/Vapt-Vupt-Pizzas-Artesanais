import React, { useState, useEffect, useMemo } from 'react';
import { Product, DailyPizzaSuggestion, DayOfWeek } from '../types.ts';
import { dbService } from '../services/dbService.ts';
import { compressImage } from '../services/imageService.ts';
import { 
  Instagram, 
  MessageCircle, 
  Copy, 
  Check, 
  Edit3, 
  Save, 
  Sparkles, 
  Calendar, 
  Flame, 
  ExternalLink, 
  Image as ImageIcon,
  RotateCcw,
  X,
  Share2
} from 'lucide-react';

interface WeeklyPizzaSuggestionsProps {
  products: Product[];
  storeName?: string;
  socialLinks?: {
    instagram?: string;
    whatsapp?: string;
    city?: string;
    address?: string;
  };
}

const DAYS_ORDER: { dayOfWeek: DayOfWeek; dayName: string; dayShort: string; dayIndex: number }[] = [
  { dayOfWeek: 'domingo', dayName: 'Domingo', dayShort: 'DOM', dayIndex: 0 },
  { dayOfWeek: 'segunda', dayName: 'Segunda-feira', dayShort: 'SEG', dayIndex: 1 },
  { dayOfWeek: 'terca', dayName: 'Terça-feira', dayShort: 'TER', dayIndex: 2 },
  { dayOfWeek: 'quarta', dayName: 'Quarta-feira', dayShort: 'QUA', dayIndex: 3 },
  { dayOfWeek: 'quinta', dayName: 'Quinta-feira', dayShort: 'QUI', dayIndex: 4 },
  { dayOfWeek: 'sexta', dayName: 'Sexta-feira', dayShort: 'SEX', dayIndex: 5 },
  { dayOfWeek: 'sabado', dayName: 'Sábado', dayShort: 'SÁB', dayIndex: 6 },
];

const DEFAULT_SUGGESTIONS: DailyPizzaSuggestion[] = [
  {
    id: 'domingo',
    dayOfWeek: 'domingo',
    dayName: 'Domingo',
    dayShort: 'DOM',
    title: '🍕 Pizza Quatro Queijos Especial & Crocante',
    description: 'Massa artesanal de fermentação lenta com cobertura generosa de mussarela premium, provolone defumado, gorgonzola importado e o legítimo requeijão Catupiry.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop',
    price: 68.90,
    promoTag: 'Domingo em Família • Borda Recheada Grátis',
  },
  {
    id: 'segunda',
    dayOfWeek: 'segunda',
    dayName: 'Segunda-feira',
    dayShort: 'SEG',
    title: '🍕 Pizza Margherita della Nonna Fresquinha',
    description: 'Comece a semana leve! Molho de tomate pelado italiano rústico, queijo derretido, rodelas de tomate maduro, folhas de manjericão fresco da horta e fio de azeite extravirgem.',
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=1000&auto=format&fit=crop',
    price: 54.90,
    promoTag: 'Segunda Leve • Preço Promocional',
  },
  {
    id: 'terca',
    dayOfWeek: 'terca',
    dayName: 'Terça-feira',
    dayShort: 'TER',
    title: '🍕 Pizza Frango Desfiado com Catupiry Real',
    description: 'A clássica campeã de pedidos! Peito de frango cozido e desfiado no tempero especial da casa, milho verde crocante e farta cobertura com Catupiry original cremoso.',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop',
    price: 59.90,
    promoTag: 'Terça do Frango • A Mais Pedida',
  },
  {
    id: 'quarta',
    dayOfWeek: 'quarta',
    dayName: 'Quarta-feira',
    dayShort: 'QUA',
    title: '🍕 Pizza Calabresa Defumada Artesanal com Cebola Roxa',
    description: 'Perfeita para acompanhar o futebol de quarta! Calabresa artesanal finamente fatiada, cebola roxa marinada, azeitonas pretas azapa, orégano e toque suave de pimenta calabresa.',
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?q=80&w=1000&auto=format&fit=crop',
    price: 52.90,
    promoTag: 'Quarta do Futebol • Compre 1 e ganhe Refri Lata',
  },
  {
    id: 'quinta',
    dayOfWeek: 'quinta',
    dayName: 'Quinta-feira',
    dayShort: 'QUI',
    title: '🍕 Pizza Portuguesa Tradicional do Chefe',
    description: 'Presunto magro cozido em tiras, ovos caipiras cozidos, cebola fresca, ervilhas verdes selecionadas, azeitonas pretas e generosa camada de queijo mussarela gratinado.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=1000&auto=format&fit=crop',
    price: 62.90,
    promoTag: 'Quinta Clássica • Receita Tradicional',
  },
  {
    id: 'sexta',
    dayOfWeek: 'sexta',
    dayName: 'Sexta-feira',
    dayShort: 'SEX',
    title: '🍕 Pizza Bacon Supremo com Muito Cheddar Cremoso',
    description: 'Sextou com crocância total! Cubos dourados de bacon defumado crocante, base farta de mussarela, cheddar cremoso derretido e finalizada com toque de cebolinha fresca.',
    image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?q=80&w=1000&auto=format&fit=crop',
    price: 66.90,
    promoTag: 'Sextou com Bacon • Campeã de Sabor',
  },
  {
    id: 'sabado',
    dayOfWeek: 'sabado',
    dayName: 'Sábado',
    dayShort: 'SÁB',
    title: '🍕 Pizza Especial da Casa com Carne Seca & Queijo Coalho',
    description: 'A jóia do sábado à noite! Carne seca desfiada na manteiga de garrafa artesanal, fatias tostadas de queijo coalho, cebola caramelizada e orégano fresco.',
    image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?q=80&w=1000&auto=format&fit=crop',
    price: 74.90,
    promoTag: 'Sábado Premium • Edição Especial do Chefe',
  },
];

export const WeeklyPizzaSuggestions: React.FC<WeeklyPizzaSuggestionsProps> = ({
  products,
  storeName = 'Pizzaria & Delivery',
  socialLinks,
}) => {
  const [suggestions, setSuggestions] = useState<DailyPizzaSuggestion[]>(DEFAULT_SUGGESTIONS);
  const [selectedFilter, setSelectedFilter] = useState<DayOfWeek | 'TODOS'>('TODOS');
  const [editingItem, setEditingItem] = useState<DailyPizzaSuggestion | null>(null);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Identify today's day of week (0 = Sunday, 1 = Monday, etc.)
  const todayIndex = new Date().getDay();
  const currentTodayInfo = DAYS_ORDER.find(d => d.dayIndex === todayIndex) || DAYS_ORDER[0];
  const todayDayOfWeek = currentTodayInfo.dayOfWeek;

  // Load from firestore or initialize defaults
  useEffect(() => {
    let isMounted = true;
    
    // Subscribe to Firestore for real-time synchronization
    const unsub = dbService.subscribe<DailyPizzaSuggestion[]>('daily_pizza_suggestions', (data) => {
      if (!isMounted) return;
      if (data && data.length > 0) {
        // Merge with full 7-day structure so all days are guaranteed
        const merged = DAYS_ORDER.map(d => {
          const found = data.find(item => item.id === d.dayOfWeek || item.dayOfWeek === d.dayOfWeek);
          if (found) return found;
          const defaultItem = DEFAULT_SUGGESTIONS.find(item => item.dayOfWeek === d.dayOfWeek)!;
          return defaultItem;
        });
        setSuggestions(merged);
      } else {
        // Seed default suggestions to firestore
        seedDefaultSuggestions();
      }
    });

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, []);

  const seedDefaultSuggestions = async () => {
    try {
      for (const item of DEFAULT_SUGGESTIONS) {
        await dbService.save('daily_pizza_suggestions', item.id, item);
      }
      setSuggestions(DEFAULT_SUGGESTIONS);
    } catch (err) {
      console.warn("Could not seed daily_pizza_suggestions:", err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Get current site URL
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bertimpastelhotdog.com.br';

  // Build WhatsApp Message formatted for sharing
  const buildWhatsAppText = (item: DailyPizzaSuggestion) => {
    if (item.customMessage && item.customMessage.trim()) {
      return item.customMessage.trim();
    }

    const priceText = item.price && item.price > 0 ? `\n💰 *Valor:* R$ ${item.price.toFixed(2)}` : '';
    const tagText = item.promoTag ? `\n🏷️ *Destaque:* ${item.promoTag}` : '';

    return `🍕 *SUGESTÃO DE ${item.dayName.toUpperCase()} • ${storeName.toUpperCase()}* 🍕

*${item.title}*

👉 ${item.description}${priceText}${tagText}

🛵 *Faça seu pedido agora sem taxas surpresas:*
🔗 ${siteUrl}

📲 Peça também pelo nosso WhatsApp: ${socialLinks?.whatsapp || ''}
Bom apetite! 😋`;
  };

  // Build Instagram Caption formatted for posting or stories
  const buildInstagramCaption = (item: DailyPizzaSuggestion) => {
    const priceText = item.price && item.price > 0 ? `\n💰 Especial de hoje: R$ ${item.price.toFixed(2)}` : '';
    const tagText = item.promoTag ? `\n✨ ${item.promoTag}` : '';
    const city = socialLinks?.city ? socialLinks.city.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'delivery';

    return `🍕 SUGESTÃO DE ${item.dayName.toUpperCase()} NA ${storeName.toUpperCase()}! 🤤🔥

${item.title}

👉 ${item.description}${priceText}${tagText}

🛵 Peça agora quentinho e crocante direto no link da nossa bio ou pelo WhatsApp!
${socialLinks?.address ? `📍 ${socialLinks.address}` : ''}

#pizza #pizzaria #delivery #pizzadodia #pizzalover #instafood #gastronomia #${city} #queijo #lanche`;
  };

  // Action: Open WhatsApp with pre-filled text
  const handleShareWhatsApp = (item: DailyPizzaSuggestion) => {
    const text = buildWhatsAppText(item);
    const encoded = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    showToast(`📲 Abrindo WhatsApp com a sugestão de ${item.dayName}!`);
  };

  // Action: Copy caption & open Instagram
  const handleShareInstagram = async (item: DailyPizzaSuggestion) => {
    const caption = buildInstagramCaption(item);
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedId(item.id + '-insta');
      setTimeout(() => setCopiedId(null), 3000);
      showToast(`✨ Legenda de ${item.dayName} copiada! Abrindo o Instagram para você postar...`);
    } catch (e) {
      console.warn("Could not copy to clipboard:", e);
    }

    const instaUrl = socialLinks?.instagram || 'https://instagram.com/';
    window.open(instaUrl, '_blank', 'noopener,noreferrer');
  };

  // Action: Copy text only
  const handleCopyText = async (item: DailyPizzaSuggestion) => {
    const text = buildWhatsAppText(item);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 3000);
      showToast(`📋 Texto da sugestão de ${item.dayName} copiado com sucesso!`);
    } catch (e) {
      console.warn("Could not copy:", e);
      showToast("Erro ao copiar texto.");
    }
  };

  // Save edited suggestion
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const updated = {
        ...editingItem,
        updatedAt: new Date().toISOString()
      };
      await dbService.save('daily_pizza_suggestions', updated.id, updated);
      setSuggestions(prev => prev.map(s => s.id === updated.id ? updated : s));
      setEditingItem(null);
      showToast(`✅ Sugestão de ${updated.dayName} atualizada com sucesso!`);
    } catch (err: any) {
      console.error("Erro ao salvar sugestão:", err);
      showToast(`Erro ao salvar: ${err?.message || err}`);
    }
  };

  // Image Upload handler
  const handleImageFile = async (file: File) => {
    if (!file || !editingItem) return;
    setIsProcessingImg(true);
    try {
      const compressed = await compressImage(file);
      setEditingItem({ ...editingItem, image: compressed });
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      showToast("Erro ao processar imagem.");
    } finally {
      setIsProcessingImg(false);
    }
  };

  // Auto-fill from existing product
  const handleSelectProduct = (prodId: string) => {
    if (!editingItem || !prodId) return;
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    setEditingItem({
      ...editingItem,
      productId: prod.id,
      title: `🍕 ${prod.name}`,
      description: prod.description || editingItem.description,
      image: prod.image || editingItem.image,
      price: prod.price || editingItem.price,
    });
    showToast(`Dados preenchidos com o produto "${prod.name}"!`);
  };

  // Reset to default templates
  const handleResetDefaults = async () => {
    if (window.confirm("Deseja redefinir as sugestões de todos os dias da semana para o padrão original da pizzaria?")) {
      await seedDefaultSuggestions();
      showToast("🔄 Sugestões da semana redefinidas para o padrão original!");
    }
  };

  // Today's item
  const todayItem = useMemo(() => {
    return suggestions.find(s => s.dayOfWeek === todayDayOfWeek) || suggestions[0];
  }, [suggestions, todayDayOfWeek]);

  // Filtered list
  const displaySuggestions = useMemo(() => {
    if (selectedFilter === 'TODOS') return suggestions;
    return suggestions.filter(s => s.dayOfWeek === selectedFilter);
  }, [suggestions, selectedFilter]);

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[120] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* HEADER DA SEÇÃO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-8 sm:p-10 rounded-[36px] shadow-xl border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-[11px] font-black uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              Sugestões da Semana
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
              🍕 Pizza do Dia • WhatsApp & Instagram
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl font-medium">
              Envie rapidamente a pizza sugerida de cada dia da semana para seus clientes no <strong>WhatsApp</strong> e compartilhe posts & stories prontos no <strong>Instagram</strong> com um clique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleResetDefaults}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2"
              title="Restaurar textos e fotos padrões para todos os 7 dias"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>
      </div>

      {/* DESTAQUE DO DIA ATUAL (HOJE) */}
      {todayItem && (
        <div className="bg-gradient-to-br from-amber-500/10 via-red-500/5 to-amber-500/10 border-2 border-amber-500/30 p-6 sm:p-8 rounded-[32px] shadow-md relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left flex-1 min-w-0">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-lg border-2 border-white shrink-0 group">
                <img 
                  src={todayItem.image} 
                  alt={todayItem.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                  Hoje!
                </div>
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <span className="bg-amber-500 text-white font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Flame className="w-3 h-3 animate-pulse" />
                    HOJE É {todayItem.dayName.toUpperCase()}
                  </span>
                  {todayItem.promoTag && (
                    <span className="bg-red-100 text-red-700 font-bold text-[10px] px-2 py-0.5 rounded-full">
                      {todayItem.promoTag}
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                  {todayItem.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                  {todayItem.description}
                </p>
                {todayItem.price && todayItem.price > 0 && (
                  <div className="text-emerald-700 font-black text-base pt-0.5">
                    R$ {todayItem.price.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* BOTÕES DE AÇÃO RÁPIDA DE HOJE */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto shrink-0">
              <button
                onClick={() => handleShareWhatsApp(todayItem)}
                className="flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                title="Disparar sugestão de hoje no WhatsApp"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Enviar no WhatsApp</span>
              </button>

              <button
                onClick={() => handleShareInstagram(todayItem)}
                className="flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                title="Copiar legenda e abrir Instagram"
              >
                <Instagram className="w-5 h-5" />
                <span>Postar no Instagram</span>
              </button>

              <button
                onClick={() => setEditingItem(todayItem)}
                className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider border border-slate-200 shadow-sm active:scale-95 transition-all"
                title="Editar sugestão de hoje"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Editar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELETOR DE DIAS DA SEMANA */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
        <button
          onClick={() => setSelectedFilter('TODOS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
            selectedFilter === 'TODOS'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Todos os 7 Dias
        </button>
        {DAYS_ORDER.map(d => {
          const isToday = d.dayOfWeek === todayDayOfWeek;
          const isSelected = selectedFilter === d.dayOfWeek;
          return (
            <button
              key={d.dayOfWeek}
              onClick={() => setSelectedFilter(d.dayOfWeek)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{d.dayName}</span>
              {isToday && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Dia atual" />
              )}
            </button>
          );
        })}
      </div>

      {/* GRADE DOS 7 DIAS DA SEMANA */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {displaySuggestions.map((item) => {
          const isToday = item.dayOfWeek === todayDayOfWeek;
          return (
            <div
              key={item.id}
              className={`bg-white rounded-[32px] border transition-all duration-300 flex flex-col overflow-hidden group ${
                isToday 
                  ? 'border-amber-400 ring-2 ring-amber-300/50 shadow-xl' 
                  : 'border-slate-200/90 hover:border-slate-300 shadow-sm hover:shadow-lg'
              }`}
            >
              {/* IMAGEM E TAGS */}
              <div className="relative h-52 w-full overflow-hidden bg-slate-100">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                {/* Badge do Dia */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full shadow-md backdrop-blur-sm ${
                    isToday ? 'bg-amber-500 text-white' : 'bg-slate-950/80 text-white'
                  }`}>
                    {item.dayName} {isToday ? '🔥 (Hoje)' : ''}
                  </span>
                </div>

                {/* Botão de Edição Rápida */}
                <button
                  onClick={() => setEditingItem(item)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-lg transition-transform active:scale-90"
                  title="Editar dados desta sugestão"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* Preço e Tag Promocional na base da imagem */}
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2 text-white">
                  <div>
                    {item.promoTag && (
                      <span className="text-[10px] font-bold bg-red-600/90 text-white px-2 py-0.5 rounded-md uppercase tracking-wider backdrop-blur-sm block mb-1">
                        {item.promoTag}
                      </span>
                    )}
                    <span className="text-base font-black truncate block">
                      {item.title}
                    </span>
                  </div>
                  {item.price && item.price > 0 && (
                    <span className="text-sm font-black bg-emerald-600 text-white px-2.5 py-1 rounded-xl shadow-md shrink-0">
                      R$ {item.price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* CORPO DO CARD */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {item.description}
                </p>

                {/* BARRA DE AÇÕES: WHATSAPP, INSTAGRAM E COPIAR */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Botão WhatsApp */}
                    <button
                      onClick={() => handleShareWhatsApp(item)}
                      className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-[11px] uppercase tracking-wider shadow-md shadow-emerald-500/10 active:scale-95 transition-all"
                      title="Abrir WhatsApp com texto formatado pronto para envio"
                    >
                      <MessageCircle className="w-4 h-4 fill-current shrink-0" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Botão Instagram */}
                    <button
                      onClick={() => handleShareInstagram(item)}
                      className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-95 text-white font-black text-[11px] uppercase tracking-wider shadow-md shadow-red-500/10 active:scale-95 transition-all"
                      title="Copiar legenda e abrir Instagram"
                    >
                      <Instagram className="w-4 h-4 shrink-0" />
                      <span>Instagram</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => handleCopyText(item)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-black">Texto Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setEditingItem(item)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Personalizar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE EDIÇÃO DA SUGESTÃO DO DIA */}
      {editingItem && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setEditingItem(null)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-[36px] max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">
                  Configuração de Conteúdo
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Editar Sugestão de {editingItem.dayName}
                </h3>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preenchimento Rápido com Produto do Cardápio */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black uppercase text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Preencher Automaticamente com Pizza do Cardápio
              </label>
              <select
                value={editingItem.productId || ''}
                onChange={e => handleSelectProduct(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-200"
              >
                <option value="">-- Selecione um produto para preencher título, foto e descrição --</option>
                {[...products]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (R$ {p.price.toFixed(2)})
                    </option>
                  ))}
              </select>
            </div>

            {/* FORMULÁRIO */}
            <div className="space-y-4">
              {/* Título */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Título da Sugestão
                </label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  placeholder="Ex: 🍕 Pizza Quatro Queijos Especial"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Descrição / Ingredientes / Detalhes
                </label>
                <textarea
                  rows={3}
                  value={editingItem.description}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="Descreva os ingredientes saborosos, tipo de massa, borda..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 leading-relaxed"
                />
              </div>

              {/* Preço e Tag Promocional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Preço Especial / Sugerido (R$)
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    value={editingItem.price || ''}
                    onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 59.90"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Tag Promocional / Destaque
                  </label>
                  <input
                    type="text"
                    value={editingItem.promoTag || ''}
                    onChange={e => setEditingItem({ ...editingItem, promoTag: e.target.value })}
                    placeholder="Ex: Compre e Ganhe Borda"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  />
                </div>
              </div>

              {/* FOTO: UPLOAD OU LINK */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center justify-between">
                  <span>Foto da Pizza</span>
                  {isProcessingImg && <span className="text-amber-600 text-[10px] animate-pulse">Comprimindo imagem...</span>}
                </label>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-inner">
                    {editingItem.image ? (
                      <img 
                        src={editingItem.image} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <input
                      type="file"
                      accept="image/*"
                      id="pizzaDayPhotoUpload"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleImageFile(f);
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="pizzaDayPhotoUpload"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider cursor-pointer transition-all border border-slate-200"
                    >
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      <span>{isProcessingImg ? 'Processando...' : 'Carregar Imagem do Dispositivo'}</span>
                    </label>

                    <input
                      type="text"
                      value={editingItem.image}
                      onChange={e => setEditingItem({ ...editingItem, image: e.target.value })}
                      placeholder="Ou cole a URL direta da foto da pizza..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Mensagem Personalizada Opcional para WhatsApp */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center justify-between">
                  <span>Mensagem Personalizada do WhatsApp (Opcional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Deixe em branco para usar o modelo automático</span>
                </label>
                <textarea
                  rows={3}
                  value={editingItem.customMessage || ''}
                  onChange={e => setEditingItem({ ...editingItem, customMessage: e.target.value })}
                  placeholder="Se preenchido, este texto exato será usado ao clicar no botão do WhatsApp."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-red-500 leading-relaxed font-mono"
                />
              </div>
            </div>

            {/* BOTÕES DO MODAL */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold uppercase text-xs transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Sugestão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
