import React, { useState, useEffect } from 'react';
import { Product, Complement, Coupon, ZipRange, PaymentSettings, BotSettings } from '../types.ts';
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw, Send, Eye, EyeOff } from 'lucide-react';

export interface BellaBotAdminProps {
  botSettings: BotSettings;
  onUpdateBotSettings: (settings: BotSettings) => void;
  products: Product[];
  complements: Complement[];
  coupons: Coupon[];
  zipRanges: ZipRange[];
  storeHours: Record<number, { enabled: boolean; open: string; close: string }>;
  paymentSettings: PaymentSettings[];
  isStoreOpen: boolean;
  storeName: string;
  socialLinks?: {
    whatsapp?: string;
    address?: string;
    city?: string;
    orderEstimatedMinutes?: number;
  };
}

export const BellaBotAdmin: React.FC<BellaBotAdminProps> = ({
  botSettings,
  onUpdateBotSettings,
  products,
  complements,
  coupons,
  zipRanges,
  storeHours,
  paymentSettings,
  isStoreOpen,
  storeName,
  socialLinks
}) => {
  const [localSettings, setLocalSettings] = useState<BotSettings>(botSettings || {
    enabled: true,
    botName: 'BellaBot',
    customPrompt: 'Você é a BellaBot, atendente e especialista em pizzas artesanais com bordas recheadas da Bella Borda. Seja alegre, simpática e use emojis de pizza 🍕🧀🥤. Sempre sugira borda recheada doce ou salgada e uma bebida refrescante. Nunca deixe o cliente sair sem pedir: seja persuasiva com carinho, ofereça opções mais acessíveis se ele achar caro e informe sobre cupons ativos.',
    promoNotice: 'Peça hoje sua pizza grande e experimente nossas bordas vulcão recheadas com Catupiry original!',
    extraInfo: 'Nossa massa é 100% artesanal com longa fermentação de 48h. Entregamos quentinho e rápido.',
    salesPushEnabled: true,
    geminiApiKey: ''
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Simulador de Chat em Tempo Real
  const [simQuery, setSimQuery] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessages, setSimMessages] = useState<{ isUser: boolean; text: string }[]>([
    {
      isUser: false,
      text: `Olá! Sou a ${localSettings.botName || 'BellaBot'} no simulador de testes do Painel. Faça uma pergunta como se fosse um cliente para testar minhas respostas e ver se estou pronta para vender!`
    }
  ]);

  useEffect(() => {
    if (botSettings) {
      setLocalSettings(botSettings);
    }
  }, [botSettings]);

  const handleSave = () => {
    onUpdateBotSettings(localSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customApiKey: localSettings.geminiApiKey })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, text: data.reply || 'Conexão com a Inteligência Artificial Gemini realizada com sucesso!' });
      } else {
        setTestResult({ success: false, text: data.error || 'Falha ao conectar com a API Gemini.' });
      }
    } catch (e: any) {
      setTestResult({ success: false, text: e.message || 'Erro ao tentar comunicação com o servidor.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSimulate = async () => {
    const q = simQuery.trim();
    if (!q || isSimulating) return;

    setSimQuery('');
    setSimMessages(prev => [...prev, { isUser: true, text: q }]);
    setIsSimulating(true);

    try {
      const history = simMessages.map(m => ({
        role: m.isUser ? 'user' : 'model',
        content: m.text
      }));
      history.push({ role: 'user', content: q });

      const storeContext = {
        storeName: storeName || 'Bella Borda Pizzaria',
        isStoreOpen,
        storeHours,
        deliveryFee: zipRanges.length > 0 ? zipRanges[0].fee : 5.0,
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
        paymentMethods: paymentSettings.filter(p => p.enabled).map(p => p.name),
        socialLinks,
        botSettings: localSettings
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          storeContext,
          customApiKey: localSettings.geminiApiKey
        })
      });

      const data = await res.json();
      if (data.text) {
        setSimMessages(prev => [...prev, { isUser: false, text: data.text }]);
      } else {
        setSimMessages(prev => [...prev, { isUser: false, text: `Erro: ${data.error || 'Sem resposta do assistente'}` }]);
      }
    } catch (err: any) {
      setSimMessages(prev => [...prev, { isUser: false, text: `Erro ao simular: ${err.message}` }]);
    } finally {
      setIsSimulating(false);
    }
  };

  const labelClass = "text-xs font-bold uppercase text-slate-500 tracking-wider ml-1 mb-1 block";
  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all placeholder:text-slate-400";

  return (
    <div className="max-w-5xl space-y-10 animate-in slide-in-from-bottom-5 duration-500 pb-20">
      {/* Banner Principal de Status */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-8 rounded-[36px] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[11px] font-black uppercase tracking-wider backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Inteligência Artificial Gemini Integrada</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase flex items-center gap-3">
            <span>🤖</span> {localSettings.botName || 'BellaBot'} IA
          </h2>
          <p className="text-red-100 text-sm max-w-2xl font-medium leading-relaxed">
            Configure o comportamento, as regras de atendimento e promoções da sua atendente virtual. Ela já lê automaticamente todo o seu cardápio, preços, bordas, cupons, taxas de entrega e horários de funcionamento!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto relative z-10">
          <button
            onClick={handleSave}
            className="px-6 py-4 bg-white text-red-600 hover:bg-red-50 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-black/10 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>💾</span>
            <span>Salvar Configurações</span>
          </button>
        </div>
      </div>

      {/* Feedback de salvamento */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg shadow-emerald-500/20 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Configurações da BellaBot salvas com sucesso no banco de dados! As novas diretrizes já estão ativas para seus clientes.</span>
        </div>
      )}

      {/* 1. Ativação e Nome da Atendente */}
      <section className="bg-white p-8 sm:p-10 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
            <span className="w-9 h-9 bg-red-100 text-red-600 rounded-xl flex items-center justify-center text-lg">⚡</span>
            Status e Identidade da Atendente
          </h3>
          <p className="text-xs text-slate-500 mt-1">Ligue ou desligue a IA no site e personalize como ela deve ser chamada.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelClass}>Status no Site</label>
            <button
              type="button"
              onClick={() => setLocalSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`w-full py-5 px-6 rounded-2xl flex items-center justify-between border-2 transition-all cursor-pointer ${
                localSettings.enabled
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-4 ring-emerald-100/60 font-black'
                  : 'bg-slate-50 border-slate-200 text-slate-400 font-bold'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{localSettings.enabled ? '🟢' : '⚪'}</span>
                <div className="text-left">
                  <p className="text-sm uppercase tracking-wider">
                    {localSettings.enabled ? 'BellaBot Ativada' : 'BellaBot Desativada'}
                  </p>
                  <p className="text-[11px] font-normal text-slate-500">
                    {localSettings.enabled ? 'Visível e pronta para atender clientes no site' : 'Oculta do site dos clientes'}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-full ${localSettings.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                {localSettings.enabled ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Nome da Atendente Virtual</label>
            <input
              type="text"
              value={localSettings.botName}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, botName: e.target.value }))}
              placeholder="Ex: BellaBot, Bella, PizzaBot"
              className={inputClass}
            />
            <p className="text-[11px] text-slate-400">Nome exibido no botão flutuante e no cabeçalho do chat.</p>
          </div>
        </div>
      </section>

      {/* 2. O Cérebro da BellaBot (Prompt & Personalidade) */}
      <section className="bg-white p-8 sm:p-10 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
            <span className="w-9 h-9 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg">🧠</span>
            Personalidade & Instruções Personalizadas (Prompt)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Defina o tom de voz e as orientações que ela deve seguir rigorosamente durante o atendimento.
          </p>
        </div>

        {/* Modelos Prontos de Personalidade */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
            Modelos Prontos de Personalidade (Clique para carregar no campo abaixo):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setLocalSettings(prev => ({
                ...prev,
                customPrompt: 'Você é a BellaBot, atendente e especialista em pizzas artesanais com bordas recheadas da Bella Borda. Seja extremamente calorosa, simpática e use emojis de pizza 🍕🧀. Sempre pergunte qual sabor o cliente prefere, sugira nossas bordas recheadas vulcão e convide-o a experimentar nossa massa italiana de fermentação lenta. Nunca deixe o cliente ir embora sem pedir!'
              }))}
              className="p-3.5 text-left rounded-2xl border border-slate-200 hover:border-red-400 hover:bg-red-50/50 transition-all group cursor-pointer"
            >
              <p className="text-xs font-black text-slate-800 group-hover:text-red-600 flex items-center gap-1.5">
                🍕 Especialista Artesanal
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Foco na tradição da massa italiana, bordas recheadas e atendimento acolhedor.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setLocalSettings(prev => ({
                ...prev,
                customPrompt: 'Você é a BellaBot, a melhor vendedora de pizzas da cidade! Seja enérgica, rápida e direta ao ponto. Ofereça sempre combos com refrigerante e sobremesa. Se o cliente estiver em dúvida ou hesitando sobre o preço, seja persuasiva com carinho, sugira tamanhos menores ou informe sobre cupons para fechar o pedido na hora.'
              }))}
              className="p-3.5 text-left rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all group cursor-pointer"
            >
              <p className="text-xs font-black text-slate-800 group-hover:text-amber-700 flex items-center gap-1.5">
                🚀 Super Vendedora Ativa
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Foco em combos, bebidas, up-selling de bordas e fechamento ágil de vendas.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setLocalSettings(prev => ({
                ...prev,
                customPrompt: 'Você é a BellaBot, especialista em ofertas e economia da Bella Borda. Ajude os clientes a encontrar as melhores promoções do dia, mostre as opções com melhor custo-benefício e informe os cupons de desconto ativos para que ele faça o pedido agora mesmo com a melhor vantagem.'
              }))}
              className="p-3.5 text-left rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group cursor-pointer"
            >
              <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700 flex items-center gap-1.5">
                🎁 Foco em Cupons & Ofertas
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Foco em divulgar promoções, vantagens e descontos especiais do dia.
              </p>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Instruções Especiais de Conversa</label>
          <textarea
            rows={4}
            value={localSettings.customPrompt}
            onChange={(e) => setLocalSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
            placeholder="Ex: Você é a BellaBot. Seja bem simpática, responda de forma curta e objetiva, sempre use emojis de pizza 🍕. Não deixe o cliente sair sem pedir..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all leading-relaxed"
          />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            💡 Dica: A BellaBot já sabe automaticamente todos os seus produtos cadastrados, valores, bordas, cupons e taxas. Use este campo para definir tom de conversa e técnicas de persuasão.
          </p>
        </div>
      </section>

      {/* 3. Promoções do Dia & Destaques Comerciais */}
      <section className="bg-white p-8 sm:p-10 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
            <span className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-lg">🏷️</span>
            Promoções do Dia & Destaques Comerciais
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Informe as ofertas especiais que a BellaBot deve apresentar ativamente aos clientes.
          </p>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Texto das Promoções em Destaque</label>
          <textarea
            rows={3}
            value={localSettings.promoNotice}
            onChange={(e) => setLocalSettings(prev => ({ ...prev, promoNotice: e.target.value }))}
            placeholder="Ex: Hoje qualquer pizza grande tem borda recheada de Catupiry com 50% de desconto! Temos o cupom BELLA10 para novos clientes."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all leading-relaxed"
          />
          <p className="text-[11px] text-slate-400">
            A BellaBot usará esses argumentos para convencer o cliente a concluir o pedido hoje mesmo.
          </p>
        </div>
      </section>

      {/* 4. Informações Extras, Políticas & Diferenciais */}
      <section className="bg-white p-8 sm:p-10 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
            <span className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-lg">ℹ️</span>
            Informações Extras & Políticas da Loja
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Orientações gerais sobre tempo médio de entrega, formas de pagamento na entrega, raio de alcance e massa artesanal.
          </p>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Políticas, Formas de Entrega e Diferenciais da Casa</label>
          <textarea
            rows={3}
            value={localSettings.extraInfo}
            onChange={(e) => setLocalSettings(prev => ({ ...prev, extraInfo: e.target.value }))}
            placeholder="Ex: Entregas em até 15km; tempo médio de 35 a 50 minutos; massa artesanal de fermentação natural 48h; aceitamos cartões e Pix na entrega; embalagem térmica lacrada."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all leading-relaxed"
          />
          <p className="text-[11px] text-slate-400">
            A BellaBot usará esse conteúdo para responder dúvidas sobre entrega, tempo de preparo e formas de pagamento.
          </p>
        </div>
      </section>

      {/* 5. Estratégia de Venda Ativa & Retenção de Clientes */}
      <section className="bg-white p-8 sm:p-10 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
            <span className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-lg">🎯</span>
            Táticas de Venda Ativa & Retenção
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Controle de insistência amigável para não deixar o cliente ir embora sem comprar.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="space-y-1 pr-4">
              <p className="text-sm font-black text-slate-800 uppercase">
                Retenção Ativa & Persuasão de Fechamento
              </p>
              <p className="text-xs text-slate-500">
                Se o cliente hesitar, achar caro ou demorar a decidir, a BellaBot sugere opções mais em conta, informa cupons ativos ou propõe tamanhos alternativos para não perder a venda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocalSettings(prev => ({ ...prev, salesPushEnabled: !prev.salesPushEnabled }))}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                localSettings.salesPushEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-white shadow-md"></div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-red-50/60 border border-red-200/80 rounded-2xl">
              <span className="text-xl">🧀</span>
              <h4 className="font-black text-xs uppercase text-red-900 mt-2">Bordas Recheadas</h4>
              <p className="text-[11px] text-red-700/90 mt-1">
                A BellaBot sempre pergunta qual borda recheada o cliente deseja adicionar para aumentar seu ticket médio.
              </p>
            </div>

            <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl">
              <span className="text-xl">🥤</span>
              <h4 className="font-black text-xs uppercase text-blue-900 mt-2">Bebidas e Sobremesas</h4>
              <p className="text-[11px] text-blue-700/90 mt-1">
                Sempre oferece refrigerante ou suco gelado para acompanhar a pizza escolhida.
              </p>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl">
              <span className="text-xl">🛒</span>
              <h4 className="font-black text-xs uppercase text-emerald-900 mt-2">Adição ao Carrinho</h4>
              <p className="text-[11px] text-emerald-700/90 mt-1">
                A IA adiciona os itens diretamente ao carrinho do cliente quando ele pedir, sem ele ter que procurar na lista!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Conexão Gemini AI & Chave de API (Opcional) */}
      <section className="bg-white p-8 sm:p-10 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
              <span className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center text-lg">🔑</span>
              Conexão com o Google Gemini AI
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              A BellaBot opera conectada aos modelos neurais avançados do Google.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Servidor Gemini Ativo
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Chave de API do Google Gemini (Opcional)</label>
              <span className="text-[11px] text-slate-400 font-medium">
                {localSettings.geminiApiKey ? 'Chave personalizada informada' : 'Usando chave padrão do sistema'}
              </span>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={localSettings.geminiApiKey || ''}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                placeholder="Deixe em branco para usar a chave padrão do servidor ou insira AIzaSy..."
                className={inputClass + " pr-12 font-mono text-sm"}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showApiKey ? "Ocultar Chave" : "Mostrar Chave"}
              >
                {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              O sistema já vem pronto para funcionar sem precisar preencher este campo. Mas se você possuir uma chave própria do Google AI Studio, pode utilizá-la aqui.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Testando Conexão...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Testar Conexão com Gemini</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-3 border animate-in fade-in ${
              testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-red-50 text-red-800 border-red-300'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-black uppercase tracking-wide">
                  {testResult.success ? 'Conexão Bem-Sucedida!' : 'Falha na Conexão'}
                </p>
                <p className="font-normal text-slate-600 leading-relaxed">{testResult.text}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 7. Simulador Interativo de Atendimento (Teste ao Vivo) */}
      <section className="bg-white p-8 sm:p-10 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
            <span className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-lg">💬</span>
            Simulador de Teste ao Vivo
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Teste como a BellaBot responde aos seus clientes usando suas configurações atuais, cardápio, horários e promoções.
          </p>
        </div>

        <div className="space-y-4">
          {/* Janela de Histórico do Simulador */}
          <div className="h-72 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            {simMessages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.isUser ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                  m.isUser ? 'bg-red-600 text-white rounded-br-none font-medium' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-xs'
                }`}>
                  {m.text}
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">{m.isUser ? 'Você (Cliente)' : localSettings.botName || 'BellaBot'}</span>
              </div>
            ))}

            {isSimulating && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></span>
                <span>{localSettings.botName || 'BellaBot'} digitando resposta...</span>
              </div>
            )}
          </div>

          {/* Botões de perguntas rápidas para teste */}
          <div className="flex flex-wrap gap-2">
            {[
              'Quais pizzas vocês têm?',
              'Quanto é a taxa de entrega?',
              'Vocês têm borda recheada?',
              'Qual o horário de funcionamento?',
              'Achei um pouco caro...'
            ].map((promptText) => (
              <button
                key={promptText}
                type="button"
                onClick={() => setSimQuery(promptText)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 rounded-full text-[11px] font-bold transition-all border border-slate-200 cursor-pointer"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Campo de envio do simulador */}
          <div className="flex gap-2">
            <input
              type="text"
              value={simQuery}
              onChange={(e) => setSimQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSimulate();
                }
              }}
              placeholder="Digite uma pergunta como se fosse um cliente..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200"
            />
            <button
              type="button"
              onClick={handleSimulate}
              disabled={isSimulating || !simQuery.trim()}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Simular</span>
            </button>
          </div>
        </div>
      </section>

      {/* Botão de Salvar no Rodapé */}
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleSave}
          className="px-10 py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 active:scale-95 flex items-center gap-3 cursor-pointer"
        >
          <span>💾</span>
          <span>Salvar Todas as Configurações da BellaBot</span>
        </button>
      </div>
    </div>
  );
};
