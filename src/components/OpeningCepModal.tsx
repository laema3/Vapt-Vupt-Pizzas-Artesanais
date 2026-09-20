import React, { useState } from 'react';
import { ZipRange } from '../types';
import { checkZipCoverage, fetchAddressByCep } from '../utils/zipUtils';

interface OpeningCepModalProps {
  isOpen: boolean;
  zipRanges: ZipRange[];
  storeName?: string;
  logoUrl?: string;
  onVerifySuccess: (cep: string, addressInfo: { address?: string; neighborhood?: string; city?: string }, fee: number) => void;
  onChoosePickup: () => void;
  onLogUncoveredCep?: (cep: string) => void;
}

export const OpeningCepModal: React.FC<OpeningCepModalProps> = ({
  isOpen,
  zipRanges,
  storeName = 'Bella Borda',
  logoUrl,
  onVerifySuccess,
  onChoosePickup,
  onLogUncoveredCep
}) => {
  const [cepInput, setCepInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    checked: boolean;
    isCovered: boolean;
    fee: number;
    addressInfo?: { address?: string; neighborhood?: string; city?: string };
    error?: string;
  }>({ checked: false, isCovered: false, fee: 0 });

  if (!isOpen) return null;

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    if (val.length > 5) {
      val = `${val.slice(0, 5)}-${val.slice(5)}`;
    }
    setCepInput(val);
    if (result.checked) {
      setResult({ checked: false, isCovered: false, fee: 0 });
    }
  };

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCep = cepInput.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setResult({ checked: true, isCovered: false, fee: 0, error: 'Digite um CEP válido com 8 dígitos.' });
      return;
    }

    setIsLoading(true);
    setResult({ checked: false, isCovered: false, fee: 0 });

    try {
      const addr = await fetchAddressByCep(cleanCep);
      const coverage = checkZipCoverage(cleanCep, zipRanges);

      if (!coverage.isCovered) {
        if (onLogUncoveredCep) {
          onLogUncoveredCep(cleanCep);
        }
      }

      setResult({
        checked: true,
        isCovered: coverage.isCovered,
        fee: coverage.fee,
        addressInfo: addr ? { address: addr.address, neighborhood: addr.neighborhood, city: addr.city } : undefined
      });
    } catch {
      const coverage = checkZipCoverage(cleanCep, zipRanges);
      setResult({
        checked: true,
        isCovered: coverage.isCovered,
        fee: coverage.fee
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedDelivery = () => {
    if (result.isCovered) {
      onVerifySuccess(cepInput, result.addressInfo || {}, result.fee);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col transform animate-in zoom-in-95 duration-300">
        
        {/* Header decorativo */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 p-6 sm:p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10 text-9xl">🍕</div>
          
          {logoUrl ? (
            <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/10 backdrop-blur-sm border-2 border-white/40 p-1 shadow-lg flex items-center justify-center">
              <img src={logoUrl} alt={storeName} className="w-full h-full object-contain rounded-full" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="text-4xl mb-2">🍕🧀</div>
          )}

          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Consulte sua Região</h2>
          <p className="text-white/90 text-xs sm:text-sm mt-1 font-medium">
            Digite seu CEP para verificarmos a disponibilidade de entrega em domicílio.
          </p>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleCheck} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                Qual o CEP da sua entrega?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="00000-000"
                  value={cepInput}
                  onChange={handleCepChange}
                  maxLength={9}
                  className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-red-600 focus:bg-white rounded-2xl px-4 py-3.5 text-lg font-bold text-slate-800 text-center tracking-widest outline-none transition-all shadow-inner"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || cepInput.replace(/\D/g, '').length < 8}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>Consultar</span>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Resultados da Consulta */}
          {result.checked && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
              {result.isCovered ? (
                <div className="bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto text-xl font-black shadow-md shadow-emerald-500/30">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-emerald-900 font-black text-lg uppercase tracking-tight">
                      Êba! Entregamos na sua região!
                    </h3>
                    {result.addressInfo?.neighborhood && (
                      <p className="text-emerald-700 text-xs font-semibold mt-0.5">
                        📍 {result.addressInfo.neighborhood} {result.addressInfo.city ? `(${result.addressInfo.city})` : ''}
                      </p>
                    )}
                    <p className="text-emerald-800 text-sm font-bold mt-2">
                      Taxa de Entrega: <span className="text-emerald-950 font-black">R$ {result.fee.toFixed(2)}</span>
                    </p>
                  </div>

                  <button
                    onClick={handleProceedDelivery}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black uppercase text-sm tracking-widest shadow-xl shadow-emerald-600/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Prosseguir para o Cardápio</span>
                    <span>→</span>
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 border-2 border-amber-400/40 rounded-2xl p-5 text-center space-y-4">
                  <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto text-xl font-black shadow-md shadow-amber-500/30">
                    🛵
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-amber-950 font-black text-base uppercase tracking-tight">
                      Ainda não atendemos na sua região no momento
                    </h3>
                    <p className="text-amber-900/80 text-xs sm:text-sm font-medium leading-relaxed">
                      Agradecemos muito pela preferência e carinho! Esperamos em breve expandir nossas rotas e levar nossas pizzas até você. 💛
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={() => {
                        onChoosePickup();
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 px-4 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>🛍️ Retirar no Balcão</span>
                    </button>
                    <button
                      onClick={() => {
                        setCepInput('');
                        setResult({ checked: false, isCovered: false, fee: 0 });
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-3.5 px-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all cursor-pointer"
                    >
                      Tentar Outro CEP
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opção secundária: Retirada caso não queira digitar CEP agora */}
          {!result.checked && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                onClick={onChoosePickup}
                className="text-xs font-bold uppercase text-slate-500 hover:text-red-600 transition-colors py-2 px-4 rounded-lg hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>🛍️ Prefiro Retirar no Balcão (Sem Consulta de CEP)</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
