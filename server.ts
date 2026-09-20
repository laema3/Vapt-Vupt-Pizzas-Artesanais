import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- REIMPLEMENTAÇÃO LIMPA MERCADO PAGO ---
app.post('/api/checkout/mercadopago', async (req, res) => {
  try {
    console.log("[MP] Iniciando criação de preferência...");
    const { items, payer, external_reference, accessToken } = req.body;
    
    console.log("[MP] Dados recebidos:", { 
      itemsCount: items?.length, 
      payerEmail: payer?.email, 
      external_reference,
      hasToken: !!accessToken 
    });

    if (!accessToken) {
      console.error("[MP] Erro: Access Token ausente.");
      return res.status(400).json({ error: 'Access Token é obrigatório' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Itens do carrinho não enviados' });
    }

    // Determina a URL base dinamicamente
    const getHeader = (name: string) => {
      const val = req.headers[name];
      return Array.isArray(val) ? val[0] : val;
    };
    
    const protocol = getHeader('x-forwarded-proto') || req.protocol;
    const host = getHeader('x-forwarded-host') || req.get('host');
    const origin = req.get('origin') || `${protocol}://${host}`;
    
    const baseUrl = process.env.APP_URL || origin;
    console.log("[MP] Base URL para retorno:", baseUrl);

    const body = {
      items: items.map((item: any) => {
        const price = Number(item.unit_price);
        if (isNaN(price)) {
          throw new Error(`Preço inválido para o item ${item.title}: ${item.unit_price}`);
        }
        return {
          id: String(item.id),
          title: String(item.title).substring(0, 250), // Limite de caracteres do MP
          quantity: Math.max(1, Number(item.quantity)),
          unit_price: price,
          currency_id: 'BRL',
        };
      }),
      payer: {
        email: payer?.email || 'cliente@email.com',
        name: payer?.name || 'Cliente',
      },
      external_reference: String(external_reference),
      notification_url: `${baseUrl}/api/webhooks/mercadopago?token=${accessToken}`,
      back_urls: {
        success: `${baseUrl}/`,
        failure: `${baseUrl}/`,
        pending: `${baseUrl}/`,
      },
      auto_return: 'approved',
    };

    console.log("[MP] Payload validado. Enviando para MP via fetch direto...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout para evitar crash da Vercel

    let mpResponse;
    try {
      mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const result = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[MP] Erro retornado pela API do Mercado Pago:', result);
      return res.status(mpResponse.status).json({
        error: 'Erro na API do Mercado Pago',
        details: result
      });
    }
    
    console.log("[MP] Preferência criada com sucesso. ID:", result.id);
    res.json({ id: result.id, init_point: result.init_point });

  } catch (error: any) {
    console.error('[MP] Erro fatal ao criar preferência:', error);
    
    let details = 'Erro desconhecido';
    try {
      if (error.response && error.response.data) {
        details = JSON.stringify(error.response.data);
      } else if (error.message) {
        details = error.message;
      } else {
        details = String(error);
      }
    } catch (e) {
      details = 'Erro ao extrair detalhes (possível referência circular)';
    }

    res.status(500).json({ 
      error: 'Erro ao processar pagamento no Mercado Pago',
      details
    });
  }
});

// --- WEBHOOK MERCADO PAGO ---
app.post('/api/webhooks/mercadopago', async (req, res) => {
  try {
    const { type, data } = req.body;
    const token = req.query.token as string;
    
    console.log("[Webhook MP] Recebido:", { type, id: data?.id, hasToken: !!token });

    if (type === 'payment' && data?.id && token) {
      // Busca os detalhes do pagamento no Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        console.log(`[Webhook MP] Status do pagamento ${data.id}:`, payment.status);
        
        if (payment.status === 'approved') {
          const orderId = payment.external_reference;
          if (orderId) {
            // Identifica o método de pagamento
            let methodLabel = 'Mercado Pago';
            const typeId = payment.payment_type_id;
            const methodId = payment.payment_method_id;
            
            if (typeId === 'credit_card') methodLabel = 'Mercado Pago - Crédito';
            else if (typeId === 'debit_card') methodLabel = 'Mercado Pago - Débito';
            else if (typeId === 'ticket') methodLabel = 'Mercado Pago - Boleto';
            else if (typeId === 'bank_transfer' || methodId === 'pix') methodLabel = 'Mercado Pago - PIX';
            else if (typeId === 'account_money') methodLabel = 'Mercado Pago - Saldo';

            // Atualiza o status no Firestore via REST API
            const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
            let firebaseConfig: any = {};
            try {
              if (fs.existsSync(configPath)) {
                firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              }
            } catch (e) {
              console.error('[Webhook MP] Erro ao ler firebase-applet-config.json:', e);
            }
            
            const projectId = firebaseConfig.projectId || 'meu-delivery-app';
            const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/orders/${orderId}?updateMask.fieldPaths=status&updateMask.fieldPaths=paymentMethod`;
            
            const updateRes = await fetch(firestoreUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: { 
                  status: { stringValue: 'NOVO' },
                  paymentMethod: { stringValue: methodLabel }
                }
              })
            });

            if (updateRes.ok) {
              console.log(`[Webhook MP] Pedido ${orderId} atualizado para NOVO (${methodLabel}) com sucesso!`);
            } else {
              console.error(`[Webhook MP] Falha ao atualizar pedido ${orderId} no Firestore:`, await updateRes.text());
            }
          }
        }
      } else {
        console.error("[Webhook MP] Erro ao buscar pagamento:", await paymentResponse.text());
      }
    }
    
    // Sempre retornar 200 OK para o Mercado Pago parar de enviar a notificação
    res.sendStatus(200);
  } catch (error) {
    console.error('[Webhook MP] Erro interno:', error);
    res.sendStatus(500);
  }
});

app.post('/api/create_pagseguro_checkout', async (req, res) => {
  try {
    const { items, sender, reference, email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ error: 'Email e Token do PagSeguro são obrigatórios' });
    }

    const isSandbox = email.includes('sandbox');
    const url = isSandbox 
      ? 'https://ws.sandbox.pagseguro.uol.com.br/v2/checkout' 
      : 'https://ws.pagseguro.uol.com.br/v2/checkout';

    const params = new URLSearchParams();
    params.append('email', email);
    params.append('token', token);
    params.append('currency', 'BRL');
    params.append('reference', reference);
    params.append('senderName', sender.name);
    params.append('senderEmail', sender.email);
    
    params.append('shippingAddressRequired', 'false');

    items.forEach((item: any, index: number) => {
      const i = index + 1;
      params.append(`itemId${i}`, item.id);
      params.append(`itemDescription${i}`, item.description);
      params.append(`itemAmount${i}`, item.amount);
      params.append(`itemQuantity${i}`, item.quantity);
    });

    console.log(`Enviando requisição para PagSeguro (${isSandbox ? 'Sandbox' : 'Produção'})...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=ISO-8859-1'
      },
      body: params
    });

    const xmlText = await response.text();
    
    if (!response.ok) {
      console.error('Erro PagSeguro:', response.status, xmlText);
      return res.status(response.status).send(xmlText);
    }

    const codeMatch = xmlText.match(/<code>(.*?)<\/code>/);
    
    if (codeMatch && codeMatch[1]) {
      res.json({ code: codeMatch[1] });
    } else {
      console.error('Código não encontrado no XML:', xmlText);
      res.status(500).json({ error: 'Código de checkout não retornado pelo PagSeguro', xml: xmlText });
    }

  } catch (error: any) {
    console.error('Erro ao criar checkout PagSeguro:', error);
    res.status(500).json({ 
      error: 'Erro interno ao processar PagSeguro',
      details: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is healthy' });
});

// --- ENDPOINTS BELLABOT IA (GEMINI API) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, storeContext, customApiKey } = req.body;
    const serverKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10)
      ? process.env.GEMINI_API_KEY.trim()
      : (process.env.VITE_API_KEY && process.env.VITE_API_KEY.trim().length > 10 ? process.env.VITE_API_KEY.trim() : '');

    const apiKey = (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 10)
      ? customApiKey.trim()
      : serverKey;

    if (!apiKey) {
      return res.status(401).json({
        keyError: true,
        error: 'Chave de API Gemini não configurada. Por favor, insira sua chave gratuita do Google Gemini no Painel Admin (aba BellaBot IA).'
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem enviada' });
    }

    const {
      storeName = 'Bella Borda Pizzaria',
      isStoreOpen = true,
      storeHours = null,
      deliveryFee = 5.0,
      zipRanges = [],
      products = [],
      complements = [],
      coupons = [],
      paymentMethods = [],
      socialLinks = {},
      cart = [],
      currentUser = null,
      botSettings = {}
    } = storeContext || {};

    const botName = botSettings.botName || 'BellaBot';
    const customPrompt = botSettings.customPrompt || '';
    const promoNotice = botSettings.promoNotice || '';
    const extraInfo = botSettings.extraInfo || '';
    const salesPushEnabled = botSettings.salesPushEnabled !== false;

    // Formatar Cardápio
    const menuSummary = products
      .filter((p: any) => !p.hidden)
      .map((p: any) => {
        const stockStatus = p.outOfStock ? ' [ESGOTADO NO MOMENTO]' : '';
        const desc = p.description ? ` - ${p.description}` : '';
        return `• ${p.name} (${p.category || 'Geral'}): R$ ${Number(p.price).toFixed(2)}${stockStatus}${desc}`;
      })
      .join('\n');

    // Formatar Bordas e Adicionais
    const bordas = complements
      .filter((c: any) => c.active && (c.type === 'BORDA' || !c.type))
      .map((c: any) => `• Borda ${c.name}: + R$ ${Number(c.price).toFixed(2)}`)
      .join('\n');

    const adicionais = complements
      .filter((c: any) => c.active && c.type === 'ADICIONAL')
      .map((c: any) => `• Adicional ${c.name}: + R$ ${Number(c.price).toFixed(2)}`)
      .join('\n');

    // Formatar Cupons
    const cuponsAtivos = coupons
      .filter((cp: any) => cp.active)
      .map((cp: any) => `• Cupom ${cp.code}: ${cp.type === 'PERCENT' ? `${cp.discount}% de desconto` : `R$ ${Number(cp.discount).toFixed(2)} de desconto`}`)
      .join('\n');

    // Formatar Formas de Pagamento
    const formasPagamento = paymentMethods && paymentMethods.length > 0
      ? paymentMethods.join(', ')
      : 'Pix, Cartão de Crédito, Cartão de Débito, Dinheiro';

    // Formatar Bairros/Taxas
    const taxasBairros = zipRanges && zipRanges.length > 0
      ? zipRanges.map((z: any) => `• CEP ${z.start} a ${z.end}: R$ ${Number(z.fee).toFixed(2)}`).join('\n')
      : `Taxa base de entrega: R$ ${Number(deliveryFee).toFixed(2)}`;

    // Formatar Horários
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    let horariosTexto = '';
    if (storeHours && typeof storeHours === 'object') {
      horariosTexto = Object.entries(storeHours).map(([dayIdx, info]: [string, any]) => {
        const dName = diasSemana[Number(dayIdx)] || `Dia ${dayIdx}`;
        if (!info || !info.enabled) return `• ${dName}: Fechado`;
        return `• ${dName}: ${info.open} às ${info.close}`;
      }).join('\n');
    } else {
      horariosTexto = '• Terça a Domingo: 18:00 às 23:30 (Segunda-feira fechado)';
    }

    // Formatar Carrinho atual do cliente
    let cartTexto = 'Carrinho vazio no momento.';
    if (cart && cart.length > 0) {
      cartTexto = cart.map((item: any) => `${item.quantity}x ${item.name} (R$ ${(item.price * item.quantity).toFixed(2)})`).join(', ');
    }

    const systemInstruction = `
Você é ${botName}, a assistente virtual e especialista em pizzas artesanais e atendimento da pizzaria "${storeName}".
Você é calorosa, muito educada, ágil, prestativa e apaixonada por pizzas irresistíveis com bordas recheadas. Use sempre uma linguagem acolhedora com emojis temáticos (🍕, 🧀, 🥤, ✨, 🛵, ❤️).

DADOS OFICIAIS E EM TEMPO REAL DA PIZZARIA:
- Nome da Loja: ${storeName}
- Status da Loja AGORA: ${isStoreOpen ? 'ABERTA E RECEBENDO PEDIDOS! ✅' : 'FECHADA NO MOMENTO ⏸️ (mas o cliente pode consultar o cardápio e montar o pedido)'}
- Horários de Funcionamento:
${horariosTexto}
- Tempo Médio de Entrega: ${socialLinks.orderEstimatedMinutes || 35} a ${(Number(socialLinks.orderEstimatedMinutes) || 35) + 15} minutos.
- Formas de Pagamento Aceitas: ${formasPagamento}.
- Endereço / Localização: ${socialLinks.address || 'Uberaba - MG'}, ${socialLinks.city || 'Uberaba'}.
- WhatsApp / Contato: ${socialLinks.whatsapp || 'Disponível no topo do site'}.
- Taxa de Entrega:
${taxasBairros}

CARDÁPIO DE PRODUTOS CADASTRADOS (ATUALIZADO):
${menuSummary || 'Pizzas artesanais tradicionais e especiais.'}

BORDAS RECHEADAS DISPONÍVEIS:
${bordas || 'Borda de Catupiry original, Cheddar cremoso, Chocolate, Nutella.'}

ADICIONAIS DISPONÍVEIS:
${adicionais || 'Bacon crocante, Queijo extra, Azeitonas pretas, Alho frito.'}

CUPONS DE DESCONTO ATIVOS:
${cuponsAtivos || 'Nenhum cupom público no momento, mas ofereça se o cliente hesitar.'}

ESTADO ATUAL DO CLIENTE:
- Nome do cliente: ${currentUser?.name || 'Cliente'}
- Itens no carrinho do cliente: ${cartTexto}

INSTRUÇÕES PERSONALIZADAS DEFINIDAS PELA GERÊNCIA:
${customPrompt || 'Atenda com excelência e ajude o cliente na escolha do pedido.'}

PROMOÇÕES E DESTAQUES DO DIA:
${promoNotice || 'Destaque nossas pizzas com bordas especiais vulcão e refrigerantes geladinhos.'}

INFORMAÇÕES EXTRAS E POLÍTICAS:
${extraInfo || 'Massa de fermentação lenta com ingredientes selecionados.'}

ESTRATÉGIA DE VENDAS E RETENÇÃO (MUITO IMPORTANTE):
${salesPushEnabled ? `
1. NUNCA DEIXE O CLIENTE IR EMBORA SEM PEDIR:
   - Se o cliente disser que está apenas olhando, apresente uma sugestão irresistível do cardápio.
   - Se achar caro ou demonstrar dúvida, ofereça uma opção mais em conta, tamanho menor, ou informe sobre cupom de desconto se houver.
   - Mostre como é rápido e fácil pedir pelo site.
2. UP-SELLING NATURAL (BORDAS E BEBIDAS):
   - Ao sugerir ou quando o cliente escolher uma pizza, SEMPRE pergunte com entusiasmo qual borda recheada ele quer colocar (cite opções como Catupiry ou Nutella).
   - Ofereça sempre uma bebida gelada para acompanhar (refrigerante, suco ou água).
3. FECHAMENTO DIRETO DO PEDIDO (ADICIONAR AO CARRINHO):
   - Quando o cliente expressar que quer pedir/adicionar um produto ao carrinho (ex: "Quero uma Calabresa", "adiciona um Guaraná", "pode mandar uma Pizza Portuguesa"), você DEVE confirmar alegremente e, NA ÚLTIMA LINHA da sua resposta, incluir a tag especial de ação:
   [ADD_TO_CART:{"productName":"Nome Exato ou Mais Próximo do Cardápio","quantity":1,"borda":"Nome da Borda se solicitada"}]
   Essa tag é lida pelo sistema para colocar o item automaticamente no carrinho do cliente sem ele precisar procurar no cardápio!
` : ''}

REGRAS GERAIS E POLÍTICA DE ENTREGA:
- REGRA CRÍTICA DE ENTREGA: Nós realizamos entregas EXCLUSIVAMENTE nas faixas de CEP autorizadas listadas acima em "Taxa de Entrega". Se o cliente informar um CEP ou perguntar se entregamos em uma região cujo CEP NÃO está em nenhuma das faixas acima (como por exemplo 38050-050 ou qualquer outro fora da lista), você DEVE informar educadamente que infelizmente a pizzaria NÃO realiza entregas para essa região/CEP, mas que ele pode realizar o pedido para RETIRADA no balcão da pizzaria! NUNCA diga que o frete é grátis para um CEP fora da lista.
- Seja sempre concisa: textos de chat diretos, fáceis de ler no celular, divididos em pequenos parágrafos ou bullet points.
- Responda apenas com informações verdadeiras que constam no cardápio e nos dados acima. Não invente produtos que não estejam cadastrados.
- Se o produto solicitado estiver com status [ESGOTADO NO MOMENTO], informe com gentileza e sugira uma alternativa similar do cardápio.
`;

    // 1. Converte e limpa mensagens
    const rawTurns = messages
      .filter((m: any) => {
        const text = String(m.content || m.text || '').trim();
        return text.length > 0;
      })
      .map((m: any) => ({
        role: (m.role === 'user' || m.isUser === true) ? 'user' : 'model',
        text: String(m.content || m.text || '').trim()
      }));

    // 2. Remove turnos iniciais do modelo (ex: mensagem de boas-vindas da BellaBot)
    // O Gemini exige que a primeira mensagem do histórico seja 'user'
    while (rawTurns.length > 0 && rawTurns[0].role === 'model') {
      rawTurns.shift();
    }

    // 3. Mescla turnos consecutivos do mesmo autor para respeitar estritamente user -> model -> user
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const turn of rawTurns) {
      if (contents.length > 0 && contents[contents.length - 1].role === (turn.role as 'user' | 'model')) {
        contents[contents.length - 1].parts[0].text += `\n${turn.text}`;
      } else {
        contents.push({ role: turn.role as 'user' | 'model', parts: [{ text: turn.text }] });
      }
    }

    // 4. Garante que o último turno seja do usuário
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: 'Olá! Pode me ajudar com o cardápio e sugestões?' }]
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError: any = null;
    let responseText = '';

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        });
        if (result && result.text) {
          responseText = result.text;
          break;
        }
      } catch (err: any) {
        console.warn(`[Gemini API] Falha no modelo ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!responseText && lastError) {
      const errMsg = String(lastError?.message || lastError || '');
      const isKeyError = errMsg.includes('leaked') || 
                         errMsg.includes('PERMISSION_DENIED') || 
                         errMsg.includes('API_KEY_INVALID') || 
                         errMsg.includes('API key not valid') || 
                         errMsg.includes('403');
      
      if (isKeyError) {
        return res.status(403).json({
          keyError: true,
          error: 'A chave da API Gemini informada foi invalidada ou bloqueada pelo Google. Por favor, gere uma nova chave em https://aistudio.google.com/app/apikey e salve na aba BellaBot IA do Painel Admin.',
          details: lastError.message
        });
      }
      throw lastError;
    }

    return res.json({
      text: responseText,
      success: true
    });

  } catch (error: any) {
    console.error('Erro na rota /api/chat:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao processar mensagem com a IA',
      details: error.message
    });
  }
});

app.post('/api/test-gemini', async (req, res) => {
  try {
    const { customApiKey } = req.body;
    const serverKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10)
      ? process.env.GEMINI_API_KEY.trim()
      : (process.env.VITE_API_KEY && process.env.VITE_API_KEY.trim().length > 10 ? process.env.VITE_API_KEY.trim() : '');

    const apiKey = (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 10)
      ? customApiKey.trim()
      : serverKey;

    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma chave de API Gemini encontrada. Insira sua chave no campo e clique em Testar.' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
    let reply = '';
    let usedModel = '';
    let lastError: any = null;

    for (const m of CANDIDATE_MODELS) {
      try {
        const result = await ai.models.generateContent({
          model: m,
          contents: 'Responda apenas: "BellaBot IA conectada com sucesso à Bella Borda Pizzaria! 🍕✨"'
        });
        if (result && result.text) {
          reply = result.text.trim();
          usedModel = m;
          break;
        }
      } catch (e: any) {
        console.warn(`[Test Gemini] Erro com ${m}:`, e.message);
        lastError = e;
      }
    }

    if (!reply) {
      const errMsg = String(lastError?.message || '');
      if (errMsg.includes('leaked')) {
        return res.status(403).json({
          success: false,
          error: 'Esta chave de API foi bloqueada pelo Google ("reported as leaked"). Por favor, gere uma nova chave em https://aistudio.google.com/app/apikey.'
        });
      }
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('PERMISSION_DENIED')) {
        return res.status(403).json({
          success: false,
          error: 'Chave de API inválida ou sem permissão. Verifique a chave no Google AI Studio (https://aistudio.google.com/app/apikey).'
        });
      }
      return res.status(500).json({ 
        success: false, 
        error: `Falha ao conectar com o modelo Gemini: ${lastError?.message || 'Tente novamente.'}` 
      });
    }

    return res.json({ success: true, reply, model: usedModel });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint dedicado para servir a logomarca para OpenGraph / WhatsApp / Redes Sociais
app.get(['/logo.jpg', '/og-image.jpg', '/logo.png', '/og-image.png', '/logo.webp', '/og-image.webp'], (req, res, next) => {
  const isJpg = req.path.endsWith('.jpg');
  const isPng = req.path.endsWith('.png');
  const isWebp = req.path.endsWith('.webp');

  const filePriority = isJpg 
    ? ['logo.jpg', 'og-image.jpg', 'logo.png', 'logo.webp']
    : isPng
    ? ['logo.png', 'og-image.png', 'logo.jpg', 'logo.webp']
    : ['logo.webp', 'og-image.webp', 'logo.png', 'logo.jpg'];

  for (const filename of filePriority) {
    const filePath = path.resolve('public', filename);
    if (fs.existsSync(filePath)) {
      const mime = filename.endsWith('.jpg') ? 'image/jpeg' : filename.endsWith('.png') ? 'image/png' : 'image/webp';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(filePath);
    }
  }
  next();
});

// Endpoint para sincronização da logomarca quando atualizada no painel administrativo
app.post('/api/sync-logo', (req, res) => {
  try {
    const { logoUrl } = req.body;
    if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('data:image/')) {
      const parts = logoUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
      const base64Data = parts[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const publicDir = path.resolve('public');
      
      const ext = mime.includes('webp') ? 'webp' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
      const tempPath = path.join(publicDir, `logo-temp.${ext}`);
      fs.writeFileSync(tempPath, buffer);
      
      try {
        execSync(`convert "${tempPath}" -quality 95 "${path.join(publicDir, 'logo.jpg')}"`);
        execSync(`convert "${tempPath}" "${path.join(publicDir, 'logo.png')}"`);
        execSync(`convert "${tempPath}" -quality 95 "${path.join(publicDir, 'og-image.jpg')}"`);
        execSync(`convert "${tempPath}" "${path.join(publicDir, 'logo.webp')}"`);
        if (fs.existsSync(tempPath) && ext !== 'webp') {
          fs.unlinkSync(tempPath);
        }
      } catch (convErr: any) {
        console.warn('Conversão via ImageMagick ignorada:', convErr?.message);
        fs.writeFileSync(path.join(publicDir, 'logo.jpg'), buffer);
        fs.writeFileSync(path.join(publicDir, 'logo.png'), buffer);
      }
      
      const distDir = path.resolve('dist');
      if (fs.existsSync(distDir)) {
        try {
          if (fs.existsSync(path.join(publicDir, 'logo.jpg'))) fs.copyFileSync(path.join(publicDir, 'logo.jpg'), path.join(distDir, 'logo.jpg'));
          if (fs.existsSync(path.join(publicDir, 'logo.png'))) fs.copyFileSync(path.join(publicDir, 'logo.png'), path.join(distDir, 'logo.png'));
        } catch (copyErr: any) {
          console.warn('Cópia para dist ignorada:', copyErr?.message);
        }
      }
      return res.json({ success: true, bytes: buffer.length });
    }
    return res.status(400).json({ error: 'Formato de logo inválido' });
  } catch (err: any) {
    console.error('Erro ao sincronizar logo:', err);
    return res.status(500).json({ error: err.message });
  }
});

// --- ROTA DE NOTIFICAÇÃO NTFY PARA CEPS FORA DE ÁREA ---
app.post('/api/notify/ntfy-out-of-area', async (req, res) => {
  try {
    const {
      topic = 'bellaborda-ceps',
      zipCode,
      customerName,
      customerPhone,
      customerEmail,
      neighborhood,
      city,
      address,
      cartTotal,
      itemsCount
    } = req.body;

    if (!zipCode) {
      return res.status(400).json({ error: 'CEP é obrigatório' });
    }

    const cleanZip = String(zipCode).replace(/\D/g, '');
    const formattedZip = cleanZip.length === 8 ? `${cleanZip.slice(0, 5)}-${cleanZip.slice(5)}` : zipCode;

    const messageLines: string[] = [
      `⚠️ TENTATIVA DE PEDIDO - CEP NÃO ATENDIDO`,
      ``,
      `📍 CEP: ${formattedZip}`
    ];
    if (neighborhood) messageLines.push(`🏘️ Bairro: ${neighborhood}`);
    if (city) messageLines.push(`🏙️ Cidade: ${city}`);
    if (address) messageLines.push(`🏠 Endereço: ${address}`);
    if (customerName) messageLines.push(`👤 Cliente: ${customerName}`);
    if (customerPhone) messageLines.push(`📞 Telefone: ${customerPhone}`);
    if (customerEmail) messageLines.push(`✉️ E-mail: ${customerEmail}`);
    if (cartTotal) messageLines.push(`💰 Total do Pedido: R$ ${Number(cartTotal).toFixed(2)}`);
    if (itemsCount) messageLines.push(`🍕 Qtd Itens: ${itemsCount}`);
    messageLines.push(`⏰ Horário: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

    const cleanTopic = String(topic || 'bellaborda-ceps').trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'bellaborda-ceps';
    const ntfyUrl = `https://ntfy.sh/${cleanTopic}`;

    console.log(`[NTFY] Despachando notificação para ${ntfyUrl} referente ao CEP ${formattedZip}`);

    const ntfyResponse = await fetch(ntfyUrl, {
      method: 'POST',
      body: messageLines.join('\n'),
      headers: {
        'Title': `📍 CEP Fora de Área: ${formattedZip}`,
        'Priority': 'high',
        'Tags': 'warning,round_pushpin,pizza',
      }
    });

    if (!ntfyResponse.ok) {
      const errText = await ntfyResponse.text();
      console.error('[NTFY] Resposta com erro do ntfy:', errText);
      return res.status(502).json({ error: 'Falha no ntfy.sh', details: errText });
    }

    return res.json({ success: true, topic: cleanTopic });
  } catch (err: any) {
    console.error('[NTFY] Erro interno:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

app.post('/api/notify/ntfy-test', async (req, res) => {
  try {
    const { topic = 'bellaborda-ceps' } = req.body;
    const cleanTopic = String(topic || 'bellaborda-ceps').trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'bellaborda-ceps';
    const ntfyUrl = `https://ntfy.sh/${cleanTopic}`;

    const testMsg = `🔔 Teste de Notificação ntfy da Bella Borda Pizzaria!\n\nTudo pronto! As notificações para pedidos com CEPs fora da área de entrega serão recebidas aqui.\n⏰ Horário: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    const ntfyResponse = await fetch(ntfyUrl, {
      method: 'POST',
      body: testMsg,
      headers: {
        'Title': '✅ Teste ntfy - Bella Borda Delivery',
        'Priority': 'default',
        'Tags': 'white_check_mark,pizza,bell',
      }
    });

    if (!ntfyResponse.ok) {
      const errText = await ntfyResponse.text();
      return res.status(502).json({ error: 'Erro no ntfy.sh', details: errText });
    }

    return res.json({ success: true, topic: cleanTopic });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Interceptor para crawlers de compartilhamento (WhatsApp, Facebook, Twitter, Telegram, etc.)
const CRAWLER_REGEX = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|linkedinbot|pinterest|discordbot/i;

app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html' || !req.path.includes('.')) && CRAWLER_REGEX.test(userAgent)) {
    try {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const rawHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'www.bellaborda.com.br';
      const host = rawHost.split(',')[0].trim();
      const baseUrl = `${proto}://${host}`;

      let htmlPath = path.resolve('dist', 'index.html');
      if (!fs.existsSync(htmlPath)) {
        htmlPath = path.resolve('index.html');
      }

      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf-8');
        html = html.replace(/https:\/\/www\.bellaborda\.com\.br\/logo\.jpg/g, `${baseUrl}/logo.jpg`);
        html = html.replace(/https:\/\/www\.bellaborda\.com\.br/g, baseUrl);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      }
    } catch (e) {
      console.error('Erro ao interceptar crawler social:', e);
    }
  }
  next();
});

// Vite middleware para desenvolvimento
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  async function setupVite() {
    // Esconde o import do Vite do bundler da Vercel
    const viteName = 'vite';
    const m = await import(/* @vite-ignore */ viteName);
    const vite = await m.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: process.cwd(),
    });
    app.use(vite.middlewares);
  }
  setupVite();
} else if (!process.env.VERCEL) {
  // Em produção fora da Vercel (ex: Docker ou VPS), servir arquivos estáticos
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve('dist', 'index.html'));
  });
}

// O listen só deve rodar se não estivermos na Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Removido o startServer() async que envolvia as rotas
