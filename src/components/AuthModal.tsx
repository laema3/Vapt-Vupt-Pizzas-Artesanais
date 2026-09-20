import React, { useState } from 'react';
import { Customer, ZipRange } from '../types';
import { dbService } from '../services/dbService';
import { fetchAddressByCep, checkZipCoverage } from '../utils/zipUtils';
import { KeyRound, Eye, EyeOff, CheckCircle2, ArrowLeft, MessageCircle, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (customer: Customer) => void;
  onSignup: (customer: Customer) => void;
  zipRanges: ZipRange[];
  storeWhatsapp?: string;
}

type AuthMode = 'login' | 'signup' | 'forgot';
type ForgotStep = 'find' | 'reset' | 'success';

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onLogin, 
  onSignup, 
  zipRanges,
  storeWhatsapp 
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [forgotStep, setForgotStep] = useState<ForgotStep>('find');
  
  // Login / Signup state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveredCustomer, setRecoveredCustomer] = useState<Customer | null>(null);
  const [confirmPhone, setConfirmPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status & Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetAllFields = () => {
    setError('');
    setSuccessMsg('');
    setIsLoading(false);
    setShowPassword(false);
    setShowNewPassword(false);
  };

  const handleClose = () => {
    resetAllFields();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);
    
    try {
      if (authMode === 'login') {
        const customer = await dbService.getCustomerByEmail(email.trim());
        if (customer && customer.password === password) {
          onLogin(customer as Customer);
          handleClose();
        } else {
          setError('E-mail ou senha inválidos.');
        }
      } else if (authMode === 'signup') {
        const existingCustomer = await dbService.getCustomerByEmail(email.trim());
        if (existingCustomer) {
          setError('Este e-mail já está cadastrado.');
          setIsLoading(false);
          return;
        }
        
        const newCustomer: Customer = {
          id: Math.random().toString(36).substring(7),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          zipCode: zipCode.trim(),
          totalOrders: 0,
          points: 0,
          lastOrder: '',
          isBlocked: false
        };
        onSignup(newCustomer);
        onLogin(newCustomer);
        handleClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Passo 1 da recuperação: Localizar conta pelo e-mail
  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const cleanEmail = forgotEmail.trim().toLowerCase();
    
    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    setIsLoading(true);
    try {
      const customer = await dbService.getCustomerByEmail(cleanEmail);
      if (!customer) {
        setError('Nenhuma conta foi localizada com esse e-mail. Verifique se digitou corretamente.');
        setIsLoading(false);
        return;
      }

      setRecoveredCustomer(customer as Customer);
      setForgotStep('reset');
      setConfirmPhone('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Passo 2 da recuperação: Validar telefone e salvar nova senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!recoveredCustomer) {
      setError('Sessão expirada. Por favor, digite seu e-mail novamente.');
      setForgotStep('find');
      return;
    }

    // Validação de telefone (WhatsApp)
    const enteredPhoneClean = confirmPhone.replace(/\D/g, '');
    const registeredPhoneClean = (recoveredCustomer.phone || '').replace(/\D/g, '');

    if (!enteredPhoneClean) {
      setError('Informe o telefone (WhatsApp) cadastrado nesta conta.');
      return;
    }

    // Permite correspondência exata ou se os últimos 4 dígitos conferem
    const isExactMatch = enteredPhoneClean === registeredPhoneClean;
    const isEndingMatch = registeredPhoneClean.endsWith(enteredPhoneClean) && enteredPhoneClean.length >= 4;
    const isPhoneMatching = isExactMatch || isEndingMatch || registeredPhoneClean.includes(enteredPhoneClean);

    if (!isPhoneMatching) {
      setError('O telefone informado não confere com o cadastro desta conta. Caso tenha mudado de número, utilize a opção de suporte pelo WhatsApp.');
      return;
    }

    // Validação da nova senha
    if (!newPassword || newPassword.length < 4) {
      setError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    setIsLoading(true);
    try {
      const updatedCustomer: Customer = {
        ...recoveredCustomer,
        password: newPassword
      };

      await dbService.save('customers', recoveredCustomer.id, updatedCustomer);
      
      // Atualiza também os campos de login para facilitar
      setEmail(recoveredCustomer.email);
      setPassword(newPassword);
      setRecoveredCustomer(updatedCustomer);
      setForgotStep('success');
      setSuccessMsg('Sua senha foi redefinida com sucesso!');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível atualizar a senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupportWhatsApp = () => {
    const rawNumber = storeWhatsapp || '5534999999999';
    const cleanNumber = rawNumber.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá! Esqueci minha senha de acesso no cardápio online e preciso de auxílio para recuperar minha conta (E-mail: ${forgotEmail || email || 'meu cadastro'}).`);
    window.open(`https://wa.me/${cleanNumber}?text=${text}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={handleClose}>
      <div className="bg-white w-full max-w-md rounded-[36px] shadow-2xl p-7 sm:p-8 animate-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        
        {/* Botão Fechar Modal */}
        <button 
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ================= MODAL: RECUPERAÇÃO DE SENHA ================= */}
        {authMode === 'forgot' ? (
          <div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                {forgotStep === 'success' ? 'Senha Redefinida!' : 'Recuperar Senha'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {forgotStep === 'find' && 'Digite seu e-mail cadastrado para redefinir a senha.'}
                {forgotStep === 'reset' && 'Confirme sua identidade para cadastrar uma nova senha.'}
                {forgotStep === 'success' && 'Tudo pronto! Sua nova senha já está ativa.'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold leading-relaxed animate-in fade-in">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold leading-relaxed flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* PASSO 1: Buscar Conta */}
            {forgotStep === 'find' && (
              <form onSubmit={handleFindAccount} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 pl-1">
                    Seu E-mail Cadastrado
                  </label>
                  <input 
                    type="email" 
                    placeholder="exemplo@email.com" 
                    value={forgotEmail} 
                    onChange={e => setForgotEmail(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 focus:bg-white transition-all" 
                    required 
                    autoFocus
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-50 mt-2"
                >
                  {isLoading ? 'Localizando conta...' : 'Continuar'}
                </button>
              </form>
            )}

            {/* PASSO 2: Validar Telefone e Redefinir Senha */}
            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Conta: </span>
                  {recoveredCustomer?.name} ({recoveredCustomer?.email})
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 pl-1">
                    Telefone (WhatsApp) Cadastrado
                  </label>
                  <input 
                    type="tel" 
                    placeholder="Ex: (34) 99999-0000" 
                    value={confirmPhone} 
                    onChange={e => setConfirmPhone(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 focus:bg-white transition-all" 
                    required 
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400 block mt-1 pl-1">
                    Confirmação de segurança para proteger sua conta.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 pl-1">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? 'text' : 'password'} 
                      placeholder="Mínimo 4 caracteres" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 focus:bg-white transition-all" 
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 pl-1">
                    Confirmar Nova Senha
                  </label>
                  <input 
                    type={showNewPassword ? 'text' : 'password'} 
                    placeholder="Repita a nova senha" 
                    value={confirmNewPassword} 
                    onChange={e => setConfirmNewPassword(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 focus:bg-white transition-all" 
                    required 
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => { setForgotStep('find'); setError(''); }}
                    className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3.5 rounded-2xl font-bold uppercase text-xs tracking-wider transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-50"
                  >
                    {isLoading ? 'Salvando...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              </form>
            )}

            {/* PASSO 3: Sucesso */}
            {forgotStep === 'success' && (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-slate-600 text-center font-medium leading-relaxed">
                  Sua senha foi redefinida com sucesso. Você pode acessar agora mesmo usando sua nova senha.
                </p>

                <button 
                  type="button" 
                  onClick={() => {
                    if (recoveredCustomer) {
                      onLogin(recoveredCustomer);
                      handleClose();
                    } else {
                      setAuthMode('login');
                    }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                >
                  Entrar na Minha Conta
                </button>
              </div>
            )}

            {/* Rodapé da Recuperação */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
              <button 
                type="button" 
                onClick={() => { setAuthMode('login'); resetAllFields(); }} 
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 uppercase tracking-widest transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Lembrou a senha? Fazer Login
              </button>

              <button 
                type="button"
                onClick={handleSupportWhatsApp}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Dúvidas? Suporte no WhatsApp da Pizzaria
              </button>
            </div>
          </div>
        ) : (
          /* ================= MODAL: LOGIN / CADASTRO ================= */
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-6 text-center">
              {authMode === 'login' ? 'Bem-vindo de volta!' : 'Criar Conta'}
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold text-center animate-in fade-in">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <input 
                    type="text" 
                    placeholder="Nome Completo" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                    required 
                  />
                  <input 
                    type="tel" 
                    placeholder="Telefone (WhatsApp)" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                    required 
                  />
                  <input 
                    type="text" 
                    placeholder="Endereço Completo" 
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                    required 
                  />
                  <input 
                    type="text" 
                    placeholder="Bairro" 
                    value={neighborhood} 
                    onChange={e => setNeighborhood(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                    required 
                  />
                  <div className="space-y-1">
                    <input 
                      type="text" 
                      placeholder="CEP (Ex: 38000-000)" 
                      value={zipCode} 
                      onChange={async (e) => {
                        const val = e.target.value;
                        setZipCode(val);
                        const clean = val.replace(/\D/g, '');
                        if (clean.length === 8) {
                          const res = await fetchAddressByCep(clean);
                          if (res && res.address) {
                            setAddress(res.address);
                            if (res.neighborhood) setNeighborhood(res.neighborhood);
                          }
                        }
                      }} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                      required 
                    />
                    {zipCode.replace(/\D/g, '').length === 8 && zipRanges && zipRanges.length > 0 && (
                      <div>
                        {checkZipCoverage(zipCode, zipRanges).isCovered ? (
                          <span className="text-[11px] font-bold text-emerald-600 block pl-1">
                            ✅ CEP dentro da área de entrega (Frete: R$ {checkZipCoverage(zipCode, zipRanges).fee.toFixed(2)})
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-600 block pl-1">
                            ⚠️ Atenção: Este CEP está fora da nossa área de entrega (pedidos precisarão ser retirados no balcão).
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              <input 
                type="email" 
                placeholder="E-mail" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                required 
              />
              
              <div>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Senha" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Link Esqueceu a Senha no Login */}
                {authMode === 'login' && (
                  <div className="flex justify-end mt-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setAuthMode('forgot');
                        setForgotStep('find');
                        setForgotEmail(email);
                        setError('');
                        setSuccessMsg('');
                      }} 
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline transition-all"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-50 mt-4"
              >
                {isLoading ? 'Aguarde...' : (authMode === 'login' ? 'Entrar' : 'Cadastrar')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => { 
                  setAuthMode(authMode === 'login' ? 'signup' : 'login'); 
                  setError(''); 
                  setSuccessMsg('');
                }} 
                className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-widest transition-colors"
              >
                {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre aqui'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
