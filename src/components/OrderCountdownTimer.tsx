import React, { useState, useEffect } from 'react';
import { OrderStatus } from '../types';

interface OrderCountdownTimerProps {
  createdAt: string;
  estimatedMinutes?: number;
  status?: OrderStatus;
  compact?: boolean;
  orderNumber?: number | string;
  onViewOrder?: () => void;
}

export const OrderCountdownTimer: React.FC<OrderCountdownTimerProps> = ({
  createdAt,
  estimatedMinutes = 30,
  status = 'NOVO',
  compact = false,
  orderNumber,
  onViewOrder
}) => {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    // Atualiza a cada segundo para contagem regressiva em tempo real
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const orderStartTime = new Date(createdAt).getTime();
  const safeEstimatedMinutes = Math.max(1, Number(estimatedMinutes) || 30);
  const totalDurationMs = safeEstimatedMinutes * 60 * 1000;
  const targetEndTime = orderStartTime + totalDurationMs;

  const diffMs = targetEndTime - currentTime;
  const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const elapsedMs = Math.max(0, currentTime - orderStartTime);
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  // Alerta vermelho pulsante nos 5 minutos finais (300 segundos)
  const isFinalized = status === 'FINALIZADO';
  const isCancelled = status === 'CANCELADO';
  const isExpired = remainingSeconds === 0 && !isFinalized && !isCancelled;
  const isFinal5Minutes = remainingSeconds > 0 && remainingSeconds <= 300 && !isFinalized && !isCancelled;

  if (isFinalized) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-black">
          <span>✅</span>
          <span>Pedido Entregue</span>
        </div>
      );
    }
    return (
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-1">
        <span className="text-2xl">🎉</span>
        <p className="font-black text-emerald-800 uppercase tracking-wide text-sm">Pedido Concluído e Entregue!</p>
        <p className="text-xs text-emerald-600 font-medium">Bom apetite! Agradecemos a preferência.</p>
      </div>
    );
  }

  if (isCancelled) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-xs font-bold">
          <span>❌</span>
          <span>Cancelado</span>
        </div>
      );
    }
    return (
      <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl text-center">
        <p className="font-bold text-slate-600 uppercase tracking-wide text-xs">Pedido Cancelado</p>
      </div>
    );
  }

  // Visualização compacta (usada nos cards de lista em Meus Pedidos)
  if (compact) {
    return (
      <div
        className={`px-3 py-2 rounded-xl flex items-center justify-between gap-3 transition-all ${
          isFinal5Minutes
            ? 'bg-red-600 text-white border-2 border-red-400 shadow-lg shadow-red-500/50 animate-pulse ring-2 ring-red-400/60'
            : isExpired
            ? 'bg-amber-100 border border-amber-300 text-amber-900'
            : 'bg-slate-100 border border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-base ${isFinal5Minutes ? 'animate-bounce' : ''}`}>
            {isFinal5Minutes ? '🚨' : isExpired ? '⏰' : '⏱️'}
          </span>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isFinal5Minutes ? 'text-red-100' : 'text-slate-500'}`}>
              {isFinal5Minutes ? 'Últimos 5 Min!' : isExpired ? 'Tempo Atingido' : 'Tempo Restante'}
            </p>
            <p className="text-sm font-black font-mono tracking-wider">
              {isExpired ? '00:00' : `${formattedMinutes}:${formattedSeconds}`}
            </p>
          </div>
        </div>

        {onViewOrder && (
          <button
            onClick={onViewOrder}
            className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-colors ${
              isFinal5Minutes
                ? 'bg-white text-red-700 hover:bg-red-50'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Ver
          </button>
        )}
      </div>
    );
  }

  // Visualização Completa (usada no Modal de Confirmação do Pedido e no topo da tela)
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 transition-all duration-300 ${
        isFinal5Minutes
          ? 'bg-gradient-to-br from-red-600 via-rose-600 to-red-700 text-white border-2 border-red-300 shadow-[0_0_35px_rgba(239,68,68,0.7)] animate-pulse ring-4 ring-red-500/40'
          : isExpired
          ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-2 border-amber-300 shadow-lg shadow-orange-500/20'
          : 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700 shadow-xl'
      }`}
    >
      {/* Indicador de Alerta de 5 minutos pulsante */}
      {isFinal5Minutes && (
        <div className="mb-3 flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm py-1.5 px-3 rounded-full border border-white/40">
          <span className="animate-ping inline-block w-2.5 h-2.5 bg-white rounded-full" />
          <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow">
            🚨 ATENÇÃO: ÚLTIMOS 5 MINUTOS RESTANTES!
          </span>
        </div>
      )}

      {isExpired && (
        <div className="mb-3 flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm py-1.5 px-3 rounded-full border border-white/40">
          <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow">
            ⏰ PREVISÃO CONCLUÍDA - SEU PEDIDO DEVE CHEGAR A QUALQUER MOMENTO
          </span>
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-1 flex items-center gap-1.5">
          <span>{isFinal5Minutes ? '🔥' : '⏱️'}</span>
          {orderNumber ? `Tempo Estimado • Pedido #${orderNumber}` : 'Tempo Estimado de Preparo / Entrega'}
        </span>

        {/* Display do Cronômetro Regressivo */}
        <div className="my-2 flex items-baseline justify-center gap-1">
          <span
            className={`font-mono font-black tracking-tight drop-shadow-md text-5xl sm:text-6xl ${
              isFinal5Minutes ? 'text-white' : 'text-amber-400'
            }`}
          >
            {formattedMinutes}:{formattedSeconds}
          </span>
        </div>

        <p className="text-xs font-bold opacity-90 mb-4 max-w-xs">
          {isFinal5Minutes
            ? 'Atenção! Seu pedido está na fase final de preparo e logo estará com você.'
            : isExpired
            ? 'Tempo de preparo finalizado. Entregador a caminho ou pedido pronto!'
            : `Contagem regressiva retroativa (Estimativa total: ${safeEstimatedMinutes} min)`}
        </p>

        {/* Barra de Progresso do Tempo */}
        <div className="w-full bg-black/30 rounded-full h-3 p-0.5 overflow-hidden border border-white/10 mb-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isFinal5Minutes
                ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-pulse'
                : isExpired
                ? 'bg-amber-300'
                : 'bg-gradient-to-r from-amber-400 to-red-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="w-full flex justify-between text-[10px] font-black uppercase tracking-widest opacity-70 px-1">
          <span>Início ({new Date(createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
          <span>{Math.round(progressPercent)}% Concluído</span>
          <span>Previsão ({new Date(targetEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
        </div>
      </div>
    </div>
  );
};
