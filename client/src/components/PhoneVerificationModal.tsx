import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  apiGetWhatsAppInfo,
  apiUpdatePhone,
  apiSendVerificationOtp,
  apiVerifyPhone,
  WhatsAppInfoResponse,
} from '../lib/auth-api';

type Step = 'phone' | 'otp' | 'done';

const iconStyle = { width: 16, height: 16, flexShrink: 0 } as const;

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={iconStyle}>
      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={iconStyle}>
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function PhoneVerificationModal({
  onClose,
  initialStep,
  initialPhoneNumber,
  onVerified,
  closeOnVerified = false,
}: {
  onClose: () => void;
  initialStep?: Step;
  initialPhoneNumber?: string;
  onVerified?: () => void | Promise<void>;
  closeOnVerified?: boolean;
}) {
  const { user, refreshUser } = useAuth();
  const resolvedInitialStep = initialStep ?? (user?.phoneNumber ? 'otp' : 'phone');
  const resolvedInitialPhoneNumber = initialPhoneNumber ?? user?.phoneNumber ?? '';
  const [step, setStep] = useState<Step>(resolvedInitialStep);
  const [phoneNumber, setPhoneNumber] = useState(resolvedInitialPhoneNumber);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [waInfo, setWaInfo] = useState<WhatsAppInfoResponse | null>(null);

  useEffect(() => {
    apiGetWhatsAppInfo().then(setWaInfo).catch(() => {});
  }, []);

  // Lock body scroll
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  async function handleSavePhone() {
    setError('');
    setSuccess('');
    if (!phoneNumber.trim() || phoneNumber.trim().length < 10) {
      setError('Gecerli bir telefon numarasi girin (min. 10 hane).');
      return;
    }
    setLoading(true);
    try {
      const res = await apiUpdatePhone(phoneNumber.trim());
      if (res.otpSent) {
        setSuccess('Dogrulama kodu WhatsApp ile gonderildi.');
        setStep('otp');
      } else {
        setError(res.otpDelivery?.error ?? res.message);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata olustu.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    setError('');
    setSuccess('');
    setResending(true);
    try {
      await apiSendVerificationOtp();
      setSuccess('Dogrulama kodu tekrar gonderildi.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kod gonderilemedi.');
    } finally {
      setResending(false);
    }
  }

  async function handleVerify() {
    setError('');
    if (!otpCode.trim() || otpCode.length !== 6) {
      setError('Lutfen 6 haneli dogrulama kodunu girin.');
      return;
    }
    setLoading(true);
    try {
      await apiVerifyPhone(otpCode.trim());
      await refreshUser();
      await onVerified?.();
      if (closeOnVerified) {
        onClose();
        return;
      }
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dogrulama basarisiz.');
    } finally {
      setLoading(false);
    }
  }

  const botPhone = waInfo?.botPhoneNumber;
  const waLink = botPhone ? `https://wa.me/${botPhone}` : null;

  return createPortal(
    <div className="pvm-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && step !== 'done' && onClose()}>
      <div className="pvm-modal" style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', width: '100%', maxWidth: 440, maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div className="pvm-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div className="pvm-header-icon" style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '1.25rem' }}>📱</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="pvm-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f3f4f6', margin: 0 }}>WhatsApp Dogrulama</h2>
            <p className="pvm-subtitle" style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.125rem 0 0 0' }}>Hesap guvenliginiz icin telefonunuzu dogrulayin</p>
          </div>
          <button className="pvm-close" onClick={onClose} aria-label="Kapat"
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '1.1rem', cursor: 'pointer', padding: '0.25rem' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="pvm-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>

          {/* ── STEP: PHONE ── */}
          {step === 'phone' && (
            <>
              <div className="pvm-info-box" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#93c5fd', lineHeight: 1.5 }}>
                <p style={{ margin: 0 }}>Sifre sifirlama ve hesap guvenlik islemleri icin telefon numaranizi WhatsApp uzerinden dogrulamaniz gerekmektedir.</p>
              </div>

              {waLink && (
                <div className="pvm-qr-section" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.75rem' }}>OTP gonderecek bot numarasi:</p>
                  <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 12, padding: 10, marginBottom: '0.5rem' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(waLink)}&bgcolor=ffffff&color=25D366&format=png`}
                      alt="WhatsApp QR"
                      style={{ width: 160, height: 160, borderRadius: 6 }}
                    />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#6b7280', maxWidth: 280, margin: '0.25rem auto 0', lineHeight: 1.45 }}>
                    QR kodu WhatsApp kameranizla tarayarak bot numarasini rehberinize ekleyebilirsiniz.
                  </p>
                </div>
              )}

              <label className="pvm-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.4rem' }}>Telefon Numarasi</label>
              <div className="pvm-input-wrap" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.625rem', padding: '0 0.875rem' }}>
                <span style={{ color: '#6b7280', marginRight: '0.5rem', display: 'flex' }}><PhoneIcon /></span>
                <input
                  className="pvm-input"
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="5551234567"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSavePhone()}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: '0.9rem', padding: '0.75rem 0', fontFamily: 'inherit' }}
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.375rem 0 0 0' }}>Turkiye icin ulke kodu olmadan girin (orn: 5551234567)</p>

              {error && <p className="pvm-error" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.8rem', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', margin: '0.75rem 0 0 0' }}>{error}</p>}

              <div className="pvm-actions" style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button className="pvm-btn pvm-btn-ghost" onClick={onClose}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.625rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Daha Sonra
                </button>
                <button className="pvm-btn pvm-btn-primary" onClick={handleSavePhone} disabled={loading}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.625rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff', border: 'none', minWidth: 110, opacity: loading ? 0.5 : 1 }}>
                  {loading ? 'Gonderiliyor...' : 'Kod Gonder'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: OTP ── */}
          {step === 'otp' && (
            <>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#6ee7b7', lineHeight: 1.5 }}>
                  <p style={{ margin: 0 }}>
                    <strong>{phoneNumber}</strong> numarasina WhatsApp uzerinden 6 haneli bir dogrulama kodu gonderildi. Kod gelmediyse tekrar gondermeyi deneyin.
                  </p>
                </div>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.4rem' }}>Dogrulama Kodu</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.625rem', padding: '0 0.875rem' }}>
                <span style={{ color: '#6b7280', marginRight: '0.5rem', display: 'flex' }}><LockIcon /></span>
                <input
                  className="pvm-input pvm-input-otp"
                  type="text"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.5em', textAlign: 'center', padding: '0.625rem 0', fontFamily: 'inherit' }}
                />
              </div>

              {error && <p style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.8rem', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', margin: '0.75rem 0 0 0' }}>{error}</p>}
              {success && <p style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7', fontSize: '0.8rem', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', margin: '0.75rem 0 0 0' }}>{success}</p>}

              <button
                onClick={handleSendOtp}
                disabled={resending}
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: resending ? '#4b5563' : '#25D366', fontSize: '0.8rem', cursor: resending ? 'default' : 'pointer', textAlign: 'center', padding: '0.625rem 0', marginTop: '0.5rem' }}
              >
                {resending ? 'Gonderiliyor...' : 'Kodu tekrar gonder'}
              </button>

              <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => { setStep('phone'); setError(''); setSuccess(''); setOtpCode(''); }}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.625rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Numarayi Degistir
                </button>
                <button onClick={handleVerify} disabled={loading}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.625rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff', border: 'none', minWidth: 110, opacity: loading ? 0.5 : 1 }}>
                  {loading ? 'Dogrulaniyor...' : 'Dogrula'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(37,211,102,0.15), rgba(16,185,129,0.15))', border: '2px solid #25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', color: '#25D366', margin: '0 auto 1rem' }}>
                ✓
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f3f4f6', margin: '0 0 0.5rem 0' }}>Dogrulama Tamamlandi!</h3>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                Telefon numaraniz basariyla dogrulandi. Artik sifre sifirlama ve guvenlik islemlerini kullanabilirsiniz.
              </p>
              <button onClick={onClose}
                style={{ width: '100%', padding: '0.6rem 1.25rem', borderRadius: '0.625rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff', border: 'none' }}>
                Devam Et
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
