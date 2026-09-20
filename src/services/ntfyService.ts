import { dbService } from './dbService';

export interface OutOfAreaNotificationData {
  zipCode: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  cartTotal?: number;
  itemsCount?: number;
  topic?: string;
}

export const DEFAULT_NTFY_TOPIC = 'bellaborda-ceps';
const RECENT_NOTIFICATIONS_KEY = 'nl_recent_out_of_area_ceps';

/**
 * Envia notificação para o tópico ntfy do lojista quando um cliente tenta fazer pedido com CEP fora de área.
 * Possui proteção de debounce anti-spam (não repete o mesmo CEP no intervalo de 2 minutos no mesmo navegador).
 */
export async function sendOutOfAreaNotification(data: OutOfAreaNotificationData): Promise<{ success: boolean; error?: string; cached?: boolean }> {
  if (!data.zipCode) return { success: false, error: 'CEP ausente' };

  const cleanZip = data.zipCode.replace(/\D/g, '');
  if (!cleanZip) return { success: false, error: 'CEP inválido' };

  // Verificação de debounce (anti-spam de 2 minutos por CEP na mesma sessão)
  const now = Date.now();
  try {
    const rawCache = typeof window !== 'undefined' ? window.sessionStorage.getItem(RECENT_NOTIFICATIONS_KEY) : null;
    const cache: Record<string, number> = rawCache ? JSON.parse(rawCache) : {};
    const lastSent = cache[cleanZip];
    if (lastSent && (now - lastSent < 2 * 60 * 1000)) {
      console.log(`[ntfyService] Notificação para CEP ${cleanZip} já enviada recentemente (debounce ativo).`);
      return { success: true, cached: true };
    }
    cache[cleanZip] = now;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(RECENT_NOTIFICATIONS_KEY, JSON.stringify(cache));
    }
  } catch (e) {
    // Ignora erros de quota de storage
  }

  const topic = (data.topic || DEFAULT_NTFY_TOPIC).trim().replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_NTFY_TOPIC;
  const formattedZip = cleanZip.length === 8 ? `${cleanZip.slice(0, 5)}-${cleanZip.slice(5)}` : data.zipCode;

  // 1. Tenta envio via API do backend Express
  let serverDispatched = false;
  try {
    const res = await fetch('/api/notify/ntfy-out-of-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        topic,
        zipCode: formattedZip
      })
    });
    if (res.ok) {
      serverDispatched = true;
      console.log('[ntfyService] Notificação enviada via backend com sucesso.');
    }
  } catch (err) {
    console.warn('[ntfyService] Falha ao enviar via rota backend, tentando envio direto...', err);
  }

  // 2. Fallback direto para o ntfy.sh caso o backend não esteja disponível
  if (!serverDispatched) {
    try {
      const bodyLines = [
        `⚠️ TENTATIVA DE PEDIDO - CEP NÃO ATENDIDO`,
        ``,
        `📍 CEP: ${formattedZip}`,
      ];
      if (data.neighborhood) bodyLines.push(`🏘️ Bairro: ${data.neighborhood}`);
      if (data.city) bodyLines.push(`🏙️ Cidade: ${data.city}`);
      if (data.address) bodyLines.push(`🏠 Endereço: ${data.address}`);
      if (data.customerName) bodyLines.push(`👤 Cliente: ${data.customerName}`);
      if (data.customerPhone) bodyLines.push(`📞 Telefone: ${data.customerPhone}`);
      if (data.customerEmail) bodyLines.push(`✉️ E-mail: ${data.customerEmail}`);
      if (data.cartTotal) bodyLines.push(`💰 Total do Pedido: R$ ${data.cartTotal.toFixed(2)}`);
      if (data.itemsCount) bodyLines.push(`🍕 Qtd Itens: ${data.itemsCount}`);
      bodyLines.push(`⏰ Horário: ${new Date().toLocaleTimeString('pt-BR')}`);

      const response = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: bodyLines.join('\n'),
        headers: {
          'Title': `📍 CEP Fora de Área: ${formattedZip}`,
          'Priority': 'high',
          'Tags': 'warning,round_pushpin,pizza',
        }
      });
      if (response.ok) {
        console.log('[ntfyService] Notificação enviada diretamente ao ntfy.sh com sucesso.');
      }
    } catch (directErr) {
      console.error('[ntfyService] Erro no envio direto ao ntfy:', directErr);
    }
  }

  // 3. Salva registro na coleção 'uncovered_ceps' do Firestore para consulta no Painel
  try {
    const logId = `${cleanZip}_${Date.now()}`;
    await dbService.save('uncovered_ceps', logId, {
      zipCode: formattedZip,
      cleanZip,
      neighborhood: data.neighborhood || '',
      city: data.city || '',
      address: data.address || '',
      customerName: data.customerName || 'Cliente',
      customerPhone: data.customerPhone || '',
      customerEmail: data.customerEmail || '',
      cartTotal: data.cartTotal || 0,
      itemsCount: data.itemsCount || 0,
      createdAt: new Date().toISOString()
    });
  } catch (dbErr) {
    console.warn('[ntfyService] Aviso: registro em uncovered_ceps não pôde ser gravado:', dbErr);
  }

  return { success: true };
}

/**
 * Envia uma notificação de teste para o tópico especificado.
 */
export async function sendTestNtfyNotification(topic: string = DEFAULT_NTFY_TOPIC): Promise<{ success: boolean; error?: string }> {
  const cleanTopic = (topic || DEFAULT_NTFY_TOPIC).trim().replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_NTFY_TOPIC;
  
  // Tenta pelo backend
  try {
    const res = await fetch('/api/notify/ntfy-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: cleanTopic })
    });
    if (res.ok) return { success: true };
  } catch (e) {
    // fallback direto
  }

  // Fallback direto
  try {
    const testMsg = `🔔 Teste de Notificação ntfy da Bella Borda Pizzaria!\n\nTudo funcionando perfeitamente! As notificações de CEPs fora da área de entrega serão recebidas neste canal.\n⏰ Horário: ${new Date().toLocaleTimeString('pt-BR')}`;
    const directRes = await fetch(`https://ntfy.sh/${cleanTopic}`, {
      method: 'POST',
      body: testMsg,
      headers: {
        'Title': '✅ Teste ntfy - Bella Borda Delivery',
        'Priority': 'default',
        'Tags': 'white_check_mark,pizza,bell',
      }
    });
    if (directRes.ok) return { success: true };
    return { success: false, error: 'Falha ao conectar com ntfy.sh' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao enviar notificação de teste' };
  }
}
