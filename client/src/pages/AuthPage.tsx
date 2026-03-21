import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LatestUsers from '../components/LatestUsers';
import { AuthApiError, WhatsAppStatus, apiForgotPassword, apiResetPassword } from '../lib/auth-api';

type Mode = 'login' | 'register' | 'forgot_password' | 'reset_password';

function getForgotPasswordErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError && error.code === 'WHATSAPP_UNAVAILABLE') {
    if (error.whatsappStatus === 'QR_READY' || error.whatsappStatus === 'INITIALIZING') {
      return 'WhatsApp dogrulama servisi hazirlaniyor. Lutfen birkac dakika sonra tekrar deneyin.';
    }

    if (error.whatsappStatus === 'DISCONNECTED') {
      return 'WhatsApp dogrulama servisi gecici olarak kapali. Lutfen daha sonra tekrar deneyin.';
    }

    return 'WhatsApp dogrulama servisi su anda hazir degil. Lutfen daha sonra tekrar deneyin.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

function getForgotPasswordHelperText(mode: Mode, whatsappWarningStatus: WhatsAppStatus | null): string {
  if (mode === 'forgot_password') {
    if (whatsappWarningStatus === 'QR_READY' || whatsappWarningStatus === 'INITIALIZING') {
      return 'WhatsApp dogrulama servisi hazirlaniyor. Birkac dakika sonra tekrar deneyin.';
    }

    if (whatsappWarningStatus === 'DISCONNECTED') {
      return 'WhatsApp dogrulama servisi gecici olarak kapali. Lutfen daha sonra tekrar deneyin.';
    }

    return 'Kayitli e-posta adresinizi ve telefon numaranizi girin, size WhatsApp uzerinden tek kullanimlik bir sifre (OTP) gonderecegiz.';
  }

  if (whatsappWarningStatus === 'QR_READY' || whatsappWarningStatus === 'INITIALIZING') {
    return 'WhatsApp dogrulama servisi hazirlaniyor. Kod geldiginde bu ekrandan yeni sifrenizi belirleyebilirsiniz.';
  }

  if (whatsappWarningStatus === 'DISCONNECTED') {
    return 'WhatsApp dogrulama servisi gecici olarak kapali. Servis duzeldiginde kodu tekrar gonderebilirsiniz.';
  }

  return 'WhatsApp uzerinden gelen dogrulama kodunu ve yeni sifrenizi girin.';
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [whatsAppWarningStatus, setWhatsAppWarningStatus] = useState<WhatsAppStatus | null>(null);

  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  // Zaten giriş yapmışsa ana sayfaya yönlendir
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setSuccessMsg('');
    setWhatsAppWarningStatus(null);
    setEmail('');
    setUsername('');
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
  }

  function validate(): string | null {
    if (mode === 'forgot_password') {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Lütfen geçerli bir e-posta adresi girin.';
      if (!phoneNumber.trim() || phoneNumber.length < 10) return 'Lütfen geçerli bir telefon numarası girin.';
      return null;
    }

    if (mode === 'reset_password') {
      if (!otpCode.trim() || otpCode.length !== 6) return 'Lütfen 6 haneli doğrulama kodunu girin.';
      if (password.length < 6) return 'Yeni şifre en az 6 karakter olmalıdır.';
      if (password !== confirmPassword) return 'Şifreler eşleşmiyor.';
      return null;
    }

    if (!email.trim()) return 'E-posta adresi gereklidir.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Geçerli bir e-posta adresi girin.';
    if (!password) return 'Şifre gereklidir.';

    if (mode === 'register') {
      if (!username.trim()) return 'Kullanıcı adı gereklidir.';
      if (username.length < 3 || username.length > 30) return 'Kullanıcı adı 3-30 karakter olmalıdır.';
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Kullanıcı adı sadece harf, rakam ve _ içerebilir.';
      if (!phoneNumber.trim() || phoneNumber.length < 10) return 'Lütfen geçerli bir telefon numarası girin (Örn: 5551234567)';
      if (password.length < 6) return 'Şifre en az 6 karakter olmalıdır.';
      if (password !== confirmPassword) return 'Şifreler eşleşmiyor.';
    }

    return null;
  }

  async function requestPasswordResetCode(targetEmail: string, targetPhoneNumber: string): Promise<void> {
    await apiForgotPassword(targetEmail, targetPhoneNumber);
    setSuccessMsg('Doğrulama kodu WhatsApp üzerinden gönderildi.');
    setWhatsAppWarningStatus(null);
  }

  async function handleResendCode() {
    setError('');
    setSuccessMsg('');

    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setError('Lütfen geçerli bir telefon numarası girin.');
      return;
    }

    setIsResendingCode(true);
    try {
      await requestPasswordResetCode(email, phoneNumber);
    } catch (err: unknown) {
      if (err instanceof AuthApiError && err.code === 'WHATSAPP_UNAVAILABLE') {
        setWhatsAppWarningStatus(err.whatsappStatus ?? null);
      }
      setError(getForgotPasswordErrorMessage(err));
    } finally {
      setIsResendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'forgot_password') {
        await requestPasswordResetCode(email, phoneNumber);
        setMode('reset_password'); // switch screen
      } else if (mode === 'reset_password') {
        const res = await apiResetPassword(email, phoneNumber, otpCode, password);
        setSuccessMsg(res.message);
        switchMode('login'); // go to login
        setSuccessMsg(res.message); // restore success msg after switch clears it
      } else if (mode === 'login') {
        await login(email, password);
        navigate('/', { replace: true });
      } else {
        await register(email, username, password, phoneNumber);
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      if ((mode === 'forgot_password' || mode === 'reset_password') && err instanceof AuthApiError && err.code === 'WHATSAPP_UNAVAILABLE') {
        setWhatsAppWarningStatus(err.whatsappStatus ?? null);
      }
      setError(mode === 'forgot_password' || mode === 'reset_password' ? getForgotPasswordErrorMessage(err) : err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page relative">
      {/* Animated background orbs */}
      <div className="auth-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>

      <div className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 z-10 w-80">
        <LatestUsers />
      </div>

      <div className="auth-container relative z-20">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <circle cx="20" cy="20" r="18" stroke="url(#g1)" strokeWidth="2.5" />
              <path d="M12 20l5 5 11-10" stroke="url(#g2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="g1" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="g2" x1="12" y1="15" x2="23" y2="25" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="auth-title">BetGuess</h1>
            <p className="auth-subtitle">Akıllı Futbol Analizi</p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card">
          {/* Tab switcher */}
          {mode === 'login' || mode === 'register' ? (
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`}
                onClick={() => switchMode('login')}
                type="button"
              >
                Giriş Yap
              </button>
              <button
                className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`}
                onClick={() => switchMode('register')}
                type="button"
              >
                Kayıt Ol
              </button>
              <div className={`auth-tab-indicator ${mode === 'register' ? 'auth-tab-indicator-right' : ''}`} />
            </div>
          ) : (
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">
                {mode === 'forgot_password' ? 'Şifremi Unuttum' : 'Yeni Şifre Belirle'}
              </h2>
              <p className="text-gray-400 text-sm">
                {getForgotPasswordHelperText(mode, whatsAppWarningStatus)}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Email - all modes */}
            <div className="auth-field">
              <label htmlFor="auth-email" className="auth-label">E-posta</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </span>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={mode === 'reset_password'}
                  onChange={e => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="ornek@email.com"
                  required
                />
              </div>
            </div>

            {/* Phone Number - Register, Forgot, Reset */}
            {(mode === 'register' || mode === 'forgot_password' || mode === 'reset_password') && (
              <div className="auth-field auth-field-slide">
                <label htmlFor="auth-phone" className="auth-label">Telefon Numarası</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </span>
                  <input
                    id="auth-phone"
                    type="tel"
                    value={phoneNumber}
                    disabled={mode === 'reset_password'}
                    onChange={e => setPhoneNumber(e.target.value)}
                    className="auth-input"
                    placeholder="5551234567"
                    required
                  />
                </div>
              </div>
            )}

            {/* OTP Code - Reset Password Only */}
            {mode === 'reset_password' && (
              <div className="auth-field auth-field-slide">
                <label htmlFor="auth-otp" className="auth-label">Doğrulama Kodu</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.281 1.051l-3.23 3.23a1 1 0 01-1.414 0L10 14.414l-2.924 2.925a1 1 0 01-1.414 0l-3.23-3.23a1 1 0 01-.281-1.051l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <input
                    id="auth-otp"
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    className="auth-input"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            )}

            {/* Username — only register */}
            {mode === 'register' && (
              <div className="auth-field auth-field-slide">
                <label htmlFor="auth-username" className="auth-label">
                  Kullanıcı Adı
                </label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <input
                    id="auth-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="auth-input"
                    placeholder="kullanici_adi"
                    required
                  />
                </div>
                <p className="auth-hint">3-30 karakter, harf/rakam/_</p>
              </div>
            )}

            {/* Password - Login, Register, Reset */}
            {mode !== 'forgot_password' && (
              <div className="auth-field">
                <label htmlFor="auth-password" className="auth-label">
                  {mode === 'reset_password' ? 'Yeni Şifre' : 'Şifre'}
                </label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="auth-input auth-input-password"
                  placeholder={mode === 'register' ? 'En az 6 karakter' : '••••••••'}
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              {mode === 'login' && (
                 <div className="flex justify-end mt-1">
                    <button type="button" onClick={() => switchMode('forgot_password')} className="text-xs text-emerald-400 hover:text-emerald-300">
                      Şifremi unuttum
                    </button>
                 </div>
              )}
            </div>
            )}

            {/* Confirm password — register or reset */}
            {(mode === 'register' || mode === 'reset_password') && (
              <div className="auth-field auth-field-slide">
                <label htmlFor="auth-confirm" className="auth-label">Şifreyi Onayla</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="auth-input"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            {/* Success Msg */}
            {successMsg && (
              <div className="auth-success bg-emerald-900/40 border border-emerald-700 text-emerald-300 px-4 py-3 rounded-xl flex gap-3 text-sm animate-fade-in" role="alert">
                <span>✅</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="auth-error" role="alert">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="auth-submit"
            >
              {isLoading ? (
                <span className="auth-spinner" />
              ) : (
                mode === 'login' ? 'Giriş Yap' : 
                mode === 'register' ? 'Kayıt Ol' : 
                mode === 'forgot_password' ? 'Kodu Gönder' : 'Şifreyi Güncelle'
              )}
            </button>

            {mode === 'reset_password' && (
              <button
                type="button"
                onClick={() => void handleResendCode()}
                disabled={isLoading || isResendingCode}
                className="w-full text-sm text-emerald-300 hover:text-emerald-200 disabled:text-gray-500 transition-colors"
              >
                {isResendingCode ? 'Kod tekrar gönderiliyor...' : 'Kodu tekrar gönder'}
              </button>
            )}

            {/* Footer hint */}
            <p className="auth-footer">
              {mode === 'login' ? (
                <>Hesabın yok mu?{' '}
                  <button type="button" onClick={() => switchMode('register')} className="auth-link">
                    Kayıt ol
                  </button>
                </>
              ) : mode === 'register' ? (
                <>Zaten hesabın var mı?{' '}
                  <button type="button" onClick={() => switchMode('login')} className="auth-link">
                    Giriş yap
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => switchMode('login')} className="auth-link">
                  ← Giriş Ekranına Dön
                </button>
              )}
            </p>

          </form>
        </div>
      </div>
    </div>
  );
}
