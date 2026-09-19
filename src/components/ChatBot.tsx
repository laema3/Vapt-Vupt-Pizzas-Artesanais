import React, { useState, useRef, useEffect } from 'react';
import { Product, CartItem, Customer, CategoryItem, SubCategoryItem, Complement, ZipRange, Coupon, PaymentSettings, BotSettings } from '../types.ts';
import { Send, Bot, Sparkles, X, ShoppingCart, Check, RefreshCw } from 'lucide-react';

interface ChatBotProps {
  products: Product[];
  categories?: CategoryItem[];
  subCategories?: SubCategoryItem[];
  complements?: Complement[];
  zipRanges?: ZipRange[];
  coupons?: Coupon[];
  storeHours?: Record<number, { enabled: boolean; open: string; close: string }>;
  paymentMethods?: PaymentSettings[];
  cart: CartItem[];
  deliveryFee: number;
  isStoreOpen: boolean;
  currentUser: Customer | null;
  onAddToCart: (
    product: Product, 
    quantity: number, 
    comps?: Complement[],
    pizzaOptions?: {
      mode: 'INTEIRA' | 'MEIO_A_MEIO';
      secondFlavor?: Product;
      calculatedBasePrice: number;
    },
    extraOptions?: {
      selectedBorda?: Complement;
      selectedMassa?: string;
      bordaGratis?: boolean;
      freeBordaReason?: string;
    }
  ) => void;
  socialLinks?: { 
    whatsapp?: string; 
    address?: string; 
    city?: string;
    slogan?: string;
    orderEstimatedMinutes?: number;
  };
  botSettings?: BotSettings;
  storeName?: string;
  onOpenCart?: () => void;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  addedItem?: {
    name: string;
    quantity: number;
    price: number;
    borda?: string;
  };
  timestamp: Date;
}

export const ChatBot: React.FC<ChatBotProps> = ({
  products,
  complements = [],
  zipRanges = [],
  coupons = [],
  storeHours,
  paymentMethods = [],
  cart,
  deliveryFee,
  isStoreOpen,
  currentUser,
  onAddToCart,
  socialLinks,
  botSettings,
  storeName = 'Bella Borda Pizzaria',
  onOpenCart
}) => {
  const botName = botSettings?.botName || 'BellaBot';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: `Olá! Sou a ${botName} 🤖🍕. Sou sua atendente virtual e especialista em pizzas artesanais e bordas recheadas da ${storeName}! Posso te ajudar com o cardápio, indicar as melhores opções, tirar dúvidas de entregas ou até montar seu pedido por aqui. O que você gostaria de pedir hoje?`,
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasNewMessageBadge, setHasNewMessageBadge] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasNewMessageBadge(false);
    }
  }, [isOpen, messages, isTyping]);

  // Função auxiliar para busca de produto por similaridade/fuzzy
  const findProductMatch = (searchName: string): Product | undefined => {
    if (!searchName) return undefined;
    const normalize = (str: string) =>
      str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const normalizedTarget = normalize(searchName);

    // 1. Busca por igualdade exata
    const exact = products.find(p => normalize(p.name) === normalizedTarget);
    if (exact) return exact;

    // 2. Busca por inclusão (ex: "calabresa" em "Pizza Calabresa Especial")
    const included = products.find(p => {
      const pNorm = normalize(p.name);
      return pNorm.includes(normalizedTarget) || normalizedTarget.includes(pNorm);
    });
    if (included) return included;

    // 3. Busca por palavras individuais
    const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 2);
    if (targetWords.length > 0) {
      const wordMatch = products.find(p => {
        const pNorm = normalize(p.name);
        return targetWords.some(w => pNorm.includes(w));
      });
      if (wordMatch) return wordMatch;
    }

    return undefined;
  };

  // Função auxiliar para busca de borda
  const findBordaMatch = (bordaName?: string): Complement | undefined => {
    if (!bordaName) return undefined;
    const normalize = (str: string) =>
      str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const target = normalize(bordaName);
    const bordas = complements.filter(c => c.active && (c.type === 'BORDA' || !c.type));

    return bordas.find(b => {
      const bNorm = normalize(b.name);
      return bNorm.includes(target) || target.includes(bNorm);
    });
  };

  const handleSend = async (textOverride?: string) => {
    const userMsg = (textOverride || input).trim();
    if (!userMsg || isTyping) return;

    const userMessageObj: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      text: userMsg,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessageObj]);
    setInput('');
    setIsTyping(true);

    try {
      // Monta histórico de mensagens para a API
      const historyPayload = messages.map(m => ({
        role: m.isUser ? 'user' : 'model',
        content: m.text
      }));
      historyPayload.push({ role: 'user', content: userMsg });

      // Dados de contexto completos da loja
      const storeContext = {
        storeName,
        isStoreOpen,
        storeHours,
        deliveryFee,
        zipRanges,
        products: products.map(p => ({
          name: p.name,
          category: p.category,
          price: p.price,
          description: p.description,
          outOfStock: p.outOfStock,
          hidden: p.hidden
        })),
        complements: complements.map(c => ({
          name: c.name,
          price: c.price,
          active: c.active,
          type: c.type || 'BORDA'
        })),
        coupons: coupons.map(cp => ({
          code: cp.code,
          discount: cp.discount,
          type: cp.type,
          active: cp.active
        })),
        paymentMethods: paymentMethods.filter(p => p.enabled).map(p => p.name),
        socialLinks,
        cart,
        currentUser: currentUser ? { name: currentUser.name, email: currentUser.email } : null,
        botSettings
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyPayload,
          storeContext,
          customApiKey: botSettings?.geminiApiKey
        })
      });

      const data = await response.json();

      if (!response.ok || !data.text) {
        throw new Error(data.error || 'Erro de comunicação');
      }

      let rawResponse: string = data.text;
      let detectedItem: { name: string; quantity: number; price: number; borda?: string } | undefined = undefined;

      // Detecta comandos de ação [ADD_TO_CART: {...}]
      const actionMatch = rawResponse.match(/\[ADD_TO_CART:\s*(\{.*?\})\s*\]/);
      if (actionMatch && actionMatch[1]) {
        try {
          const actionData = JSON.parse(actionMatch[1]);
          const matchedProduct = findProductMatch(actionData.productName);

          if (matchedProduct) {
            const quantity = Number(actionData.quantity) || 1;
            const matchedBorda = findBordaMatch(actionData.borda);

            onAddToCart(
              matchedProduct,
              quantity,
              undefined,
              undefined,
              matchedBorda ? { selectedBorda: matchedBorda } : undefined
            );

            detectedItem = {
              name: matchedProduct.name,
              quantity,
              price: matchedProduct.price,
              borda: matchedBorda ? matchedBorda.name : undefined
            };
          }
        } catch (parseErr) {
          console.warn('Erro ao processar tag ADD_TO_CART:', parseErr);
        }

        // Limpa a tag da mensagem visível ao usuário
        rawResponse = rawResponse.replace(/\[ADD_TO_CART:\s*\{.*?\}\s*\]/g, '').trim();
      }

      const botMessageObj: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        text: rawResponse,
        isUser: false,
        addedItem: detectedItem,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessageObj]);

      if (!isOpen) {
        setHasNewMessageBadge(true);
      }

    } catch (err: any) {
      console.error('[ChatBot] Erro ao conversar:', err);
      const errMsg = String(err?.message || '');
      const isKeyProblem = errMsg.toLowerCase().includes('chave') || 
                           errMsg.toLowerCase().includes('gemini') || 
                           errMsg.toLowerCase().includes('leaked') ||
                           errMsg.toLowerCase().includes('permission_denied') ||
                           errMsg.toLowerCase().includes('api');

      const responseMessage = isKeyProblem
        ? `${errMsg || 'A chave do Google Gemini precisa ser configurada.'}\n\n👉 Você pode gerar uma chave gratuita em aistudio.google.com/app/apikey e salvar na aba "BellaBot IA" do Painel de Controle.`
        : 'Puxa, tive uma instabilidade momentânea na conexão 🍕. Você pode tentar novamente ou se preferir pode adicionar seu pedido diretamente pelo cardápio!';

      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          text: responseMessage,
          isUser: false,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    '🍕 Sugestão do Chef',
    '🧀 Quais as bordas recheadas?',
    '🛵 Quanto é a taxa de entrega?',
    '⏰ Quais os horários de funcionamento?',
    '🎟️ Tem algum cupom de desconto?',
    '🥤 Quais bebidas estão disponíveis?'
  ];

  if (botSettings && botSettings.enabled === false) {
    return null;
  }

  return (
    <>
      {/* Botão Flutuante */}
      <button
        id="btn-bellabot-toggle"
        onClick={() => {
          setIsOpen(!isOpen);
          setHasNewMessageBadge(false);
        }}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl hover:shadow-red-600/50 transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white/20"
        aria-label="Abrir BellaBot Atendente Virtual"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg shadow-inner">
            🤖
          </div>
          {/* Indicador pulsante */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
          </span>
        </div>

        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-black uppercase tracking-wider leading-none flex items-center gap-1.5">
            {botName} IA <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
          </span>
          <span className="text-[10px] text-red-100 font-bold leading-tight mt-0.5">
            Atendente Virtual 24h
          </span>
        </div>

        {hasNewMessageBadge && (
          <span className="w-3 h-3 bg-amber-400 rounded-full animate-bounce shadow-md"></span>
        )}
      </button>

      {/* Janela do Chat */}
      {isOpen && (
        <div
          id="modal-bellabot-window"
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[420px] max-w-[440px] bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[560px] max-h-[85vh] animate-in slide-in-from-bottom-6 duration-300"
        >
          {/* Cabeçalho */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 sm:p-5 flex items-center justify-between text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-md border-2 border-red-100">
                🤖
              </div>
              <div>
                <h3 className="font-black text-white uppercase text-sm tracking-wide flex items-center gap-2">
                  {botName} IA
                  <span className="text-[9px] bg-white/20 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/20">
                    IA Gemini
                  </span>
                </h3>
                <p className="text-[11px] text-red-100 font-bold flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  {isStoreOpen ? 'Atendendo agora • Loja Aberta' : 'Atendendo agora • Loja Fechada'}
                </p>
              </div>
            </div>

            <button
              id="btn-close-bellabot"
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              title="Fechar chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50 scroll-smooth">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[88%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.isUser
                      ? 'bg-red-600 text-white rounded-br-none font-medium'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none font-normal'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Card de confirmação de item adicionado */}
                {msg.addedItem && (
                  <div className="mt-2 w-[88%] bg-emerald-50 border-2 border-emerald-300/80 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-2 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shrink-0 shadow-sm">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-900 truncate">
                          {msg.addedItem.quantity}x {msg.addedItem.name}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-700">
                          {msg.addedItem.borda ? `+ Borda ${msg.addedItem.borda} • ` : ''}
                          R$ {(msg.addedItem.price * msg.addedItem.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onOpenCart?.();
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>Carrinho</span>
                    </button>
                  </div>
                )}

                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-slate-500 animate-in fade-in">
                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></span>
                  <span className="text-[11px] font-bold text-slate-500 ml-2">Digitando resposta...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões Rápidas */}
          <div className="px-3 py-2 bg-slate-100 border-t border-slate-200/80 flex gap-2 overflow-x-auto no-scrollbar">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                disabled={isTyping}
                className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 hover:text-red-700 text-slate-700 rounded-full text-[11px] font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Campo de Envio */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              id="input-bellabot-message"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite aqui sua dúvida ou pedido..."
              disabled={isTyping}
              className="flex-1 bg-slate-100 hover:bg-slate-50 focus:bg-white border border-transparent focus:border-red-400 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all"
            />
            <button
              id="btn-bellabot-send"
              type="submit"
              disabled={isTyping || !input.trim()}
              className="w-11 h-11 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-2xl flex items-center justify-center transition-all shadow-md shadow-red-600/20 active:scale-95 disabled:cursor-not-allowed"
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
