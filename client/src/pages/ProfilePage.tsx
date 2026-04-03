import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AdminUserDetail } from '../lib/auth-types';
import { apiGetProfile, apiUpdateProfile, apiChangePassword } from '../lib/auth-api';
import PhoneVerificationModal from '../components/PhoneVerificationModal';
import { useUsageStatus } from '../hooks/useUsageStatus';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function tierLabel(tier: string) {
  const m: Record<string, string> = { free: 'Ucretsiz', pro: 'Pro', premium: 'Premium' };
  return m[tier] ?? tier;
}

function tierClass(tier: string) {
  const m: Record<string, string> = { free: 'prof-tier-free', pro: 'prof-tier-pro', premium: 'prof-tier-premium' };
  return m[tier] ?? 'prof-tier-free';
}

// ─── Section components ──────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prof-info-row">
      <span className="prof-info-label">{label}</span>
      <span className="prof-info-value">{children}</span>
    </div>
  );
}

function normalizePhoneForComparison(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `90${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `90${digits}`;
  }

  if (digits.startsWith('00')) {
    return digits.slice(2);
  }

  return digits;
}

function EditAccountModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: AdminUserDetail;
  onClose: () => void;
  onSaved: (result: { profile: AdminUserDetail; otpSent: boolean; otpDelivery: { error: string | null } | null }) => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [title, setTitle] = useState(profile.title ?? '');
  const [email, setEmail] = useState(profile.email);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const normalizedCurrentEmail = profile.email.trim().toLowerCase();
  const normalizedNextEmail = email.trim().toLowerCase();
  const normalizedCurrentPhone = normalizePhoneForComparison(profile.phoneNumber);
  const normalizedNextPhone = normalizePhoneForComparison(phoneNumber);
  const criticalChanged = normalizedNextEmail !== normalizedCurrentEmail || normalizedNextPhone !== normalizedCurrentPhone;

  async function handleSave() {
    const titleChanged = title.trim() !== (profile.title ?? '');
    if (
      username.trim() === profile.username
      && normalizedNextEmail === normalizedCurrentEmail
      && normalizedNextPhone === normalizedCurrentPhone
      && !titleChanged
    ) {
      onClose();
      return;
    }

    if (criticalChanged && !currentPassword.trim()) {
      setError('E-posta veya telefon numarasini degistirmek icin mevcut sifrenizi girin.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await apiUpdateProfile({
        username: username.trim(),
        email: normalizedNextEmail,
        phoneNumber: phoneNumber.trim(),
        title: title.trim() || null,
        currentPassword: criticalChanged ? currentPassword : undefined,
      });
      onSaved(result);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata olustu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prof-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="prof-modal">
        <h3 className="prof-modal-title">Hesap Bilgilerini Duzenle</h3>
        <label className="prof-field-label">Kullanici Adi</label>
        <input
          className="prof-input"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Kullanici adiniz"
          autoFocus
        />
        <p className="prof-input-hint">3-30 karakter, harf, rakam ve alt cizgi kullanilabilir.</p>

        <label className="prof-field-label" style={{ marginTop: '0.75rem' }}>Unvan</label>
        <input
          className="prof-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ornegin: Futbol Analisti"
          maxLength={50}
        />
        <p className="prof-input-hint">Profilinizde gorunecek unvan (en fazla 50 karakter). Bos birakilabilir.</p>

        <label className="prof-field-label" style={{ marginTop: '0.75rem' }}>E-posta</label>
        <input
          className="prof-input"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="E-posta adresiniz"
        />

        <label className="prof-field-label" style={{ marginTop: '0.75rem' }}>Telefon Numarasi</label>
        <input
          className="prof-input"
          type="tel"
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          placeholder="5551234567"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <p className="prof-input-hint">Turkiye icin numarayi 10 haneli girebilirsiniz.</p>

        {criticalChanged && (
          <>
            <label className="prof-field-label" style={{ marginTop: '0.75rem' }}>Mevcut Sifre</label>
            <input
              className="prof-input"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Guvenlik icin mevcut sifreniz"
            />
            <p className="prof-input-hint">E-posta veya telefon degisikligi kritik bilgi olarak kabul edilir.</p>
          </>
        )}

        {error && <p className="prof-error">{error}</p>}
        <div className="prof-modal-actions">
          <button className="prof-btn prof-btn-ghost" onClick={onClose} disabled={saving}>Iptal</button>
          <button className="prof-btn prof-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Change Password Modal ───────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setError('');
    if (newPw !== confirm) {
      setError('Yeni sifreler eslesmiyor.');
      return;
    }
    if (newPw.length < 6) {
      setError('Yeni sifre en az 6 karakter olmalidir.');
      return;
    }
    setSaving(true);
    try {
      const result = await apiChangePassword(current, newPw);
      setSuccess(result.message);
      setTimeout(onClose, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata olustu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prof-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="prof-modal">
        <h3 className="prof-modal-title">Sifre Degistir</h3>

        <label className="prof-field-label">Mevcut Sifre</label>
        <input
          className="prof-input"
          type="password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          placeholder="Mevcut sifreniz"
          autoFocus
        />

        <label className="prof-field-label" style={{ marginTop: '0.75rem' }}>Yeni Sifre</label>
        <input
          className="prof-input"
          type="password"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          placeholder="En az 6 karakter"
        />

        <label className="prof-field-label" style={{ marginTop: '0.75rem' }}>Yeni Sifre (Tekrar)</label>
        <input
          className="prof-input"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Yeni sifrenizi tekrar girin"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />

        {error && <p className="prof-error">{error}</p>}
        {success && <p className="prof-success">{success}</p>}

        <div className="prof-modal-actions">
          <button className="prof-btn prof-btn-ghost" onClick={onClose} disabled={saving}>Iptal</button>
          <button className="prof-btn prof-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Sifreyi Degistir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

type ModalType = null | 'account' | 'password';

export default function ProfilePage() {
  const { isAdmin, refreshUser } = useAuth();
  const { data: usage, loading: usageLoading } = useUsageStatus();
  const [profile, setProfile] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalType>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning'; message: string } | null>(null);
  const [verificationPhone, setVerificationPhone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProfile(await apiGetProfile());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Profil yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="prof-root">
        <div className="prof-loading"><span className="prof-spinner" />Yukleniyor...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="prof-root">
        <div className="prof-error-box">{error || 'Profil bulunamadi.'}</div>
      </div>
    );
  }

  const subExpired = profile.subscriptionExpiresAt && new Date(profile.subscriptionExpiresAt) < new Date();

  return (
    <div className="prof-root">
      {/* Hero */}
      <div className="prof-hero">
        <div className="prof-avatar">
          {profile.username.charAt(0).toUpperCase()}
        </div>
        <div className="prof-hero-info">
          <h1 className="prof-hero-name">{profile.username}</h1>
          <p className="prof-hero-email">{profile.email}</p>
          <div className="prof-hero-badges">
            <span className={`prof-badge ${isAdmin ? 'prof-badge-admin' : 'prof-badge-user'}`}>
              {isAdmin ? '★ Admin' : '• Kullanici'}
            </span>
            <span className={`prof-badge ${tierClass(profile.subscriptionTier)}`}>
              {tierLabel(profile.subscriptionTier)}
            </span>
            {profile.title && (
              <span className="prof-badge prof-badge-title">{profile.title}</span>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className="prof-card"
          style={{
            marginBottom: '1rem',
            borderColor: feedback.tone === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
            background: feedback.tone === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            color: feedback.tone === 'success' ? '#a7f3d0' : '#fcd34d',
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Cards grid */}
      <div className="prof-grid">
        {/* Account info */}
        <div className="prof-card">
          <div className="prof-card-header">
            <h2 className="prof-card-title">Hesap Bilgileri</h2>
            <button className="prof-btn prof-btn-sm prof-btn-ghost" onClick={() => setModal('account')}>
              Duzenle
            </button>
          </div>
          <InfoRow label="Kullanici Adi">{profile.username}</InfoRow>
          <InfoRow label="E-posta">{profile.email}</InfoRow>
          <InfoRow label="Unvan">{profile.title || <span className="prof-muted">Belirlenmemis</span>}</InfoRow>
          <InfoRow label="Telefon">
            {profile.phoneNumber ? (
              <span className="prof-phone-row">
                {profile.phoneNumber}
                {profile.phoneVerified
                  ? <span className="prof-verified">Dogrulandi</span>
                  : <span className="prof-unverified">Dogrulanmadi</span>
                }
              </span>
            ) : (
              <span className="prof-muted">Girilmemis</span>
            )}
          </InfoRow>
          <InfoRow label="Kayit Tarihi">{fmtDate(profile.createdAt)}</InfoRow>
        </div>

        {/* Subscription */}
        <div className="prof-card">
          <h2 className="prof-card-title">Abonelik</h2>
          <div className="prof-sub-card">
            <div className={`prof-sub-tier ${tierClass(profile.subscriptionTier)}`}>
              <span className="prof-sub-icon">
                {profile.subscriptionTier === 'premium' ? '💎' : profile.subscriptionTier === 'pro' ? '⚡' : '🆓'}
              </span>
              <span className="prof-sub-name">{tierLabel(profile.subscriptionTier)}</span>
            </div>
            {profile.subscriptionExpiresAt && (
              <div className={`prof-sub-expiry ${subExpired ? 'prof-sub-expired' : ''}`}>
                {subExpired ? 'Suresi doldu: ' : 'Bitis: '}{fmtDate(profile.subscriptionExpiresAt)}
              </div>
            )}
            {profile.subscriptionTier === 'free' && (
              <p className="prof-sub-hint">Ucretsiz plan kullaniyorsunuz.</p>
            )}
          </div>
        </div>

        {/* Usage Limits */}
        <div className="prof-card">
          <h2 className="prof-card-title">Günlük Kullanım</h2>
          <div className="flex flex-col gap-2 mt-2">
            {usageLoading ? (
              <span className="text-gray-400 text-sm">Hesaplanıyor...</span>
            ) : usage ? (
              Object.entries(usage.limits).map(([key, limit]) => {
                if (key === 'saved_coupons') return null; // skipped
                const labelMap: Record<string, string> = {
                  forum_topic: 'Forum Konu Açma',
                  forum_comment: 'Forum Yorum',
                  ai_match: 'AI Maç Analizi',
                  ai_bulk: 'AI Toplu Analiz'
                };
                const label = labelMap[key] || key;
                return (
                  <div key={key} className="flex justify-between items-center text-sm border-b border-gray-700/50 pb-2 mb-1 last:border-0">
                    <span className="text-gray-300">{label}</span>
                    <span className="font-semibold text-white">
                      {limit.limit === -1 
                        ? 'Sınırsız' 
                        : limit.limit === 0 
                          ? <span className="text-red-400">Kilitli</span>
                          : <span className={limit.used >= limit.limit ? 'text-amber-500' : 'text-emerald-400'}>
                              {limit.used} / {limit.limit}
                            </span>
                      }
                    </span>
                  </div>
                );
              })
            ) : (
              <span className="text-gray-500 text-sm">Veri yok.</span>
            )}
          </div>
        </div>

        {/* Activity */}
        <div className="prof-card">
          <h2 className="prof-card-title">Aktivite</h2>
          <InfoRow label="Olusturulan Kupon">
            <span className="prof-coupon-count">{profile.couponCount}</span>
          </InfoRow>
          {profile.lastCouponAt && (
            <InfoRow label="Son Kupon">{fmtDate(profile.lastCouponAt)}</InfoRow>
          )}
          <InfoRow label="Son Guncelleme">{fmtDate(profile.updatedAt)}</InfoRow>
        </div>

        {/* Security */}
        <div className="prof-card">
          <h2 className="prof-card-title">Guvenlik</h2>
          <div className="prof-security-row">
            <div>
              <p className="prof-security-label">Sifre</p>
              <p className="prof-security-hint">Sifrenizi duzenli olarak degistirmeniz onerilir.</p>
            </div>
            <button className="prof-btn prof-btn-sm prof-btn-outline" onClick={() => setModal('password')}>
              Degistir
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'account' && (
        <EditAccountModal
          profile={profile}
          onClose={() => setModal(null)}
          onSaved={async (result) => {
            setProfile(result.profile);
            await refreshUser();
            await load();

            if (result.otpSent && result.profile.phoneNumber) {
              setFeedback({ tone: 'success', message: 'Profil guncellendi. Telefon numaranizi dogrulamak icin OTP gonderildi.' });
              setVerificationPhone(result.profile.phoneNumber);
              return;
            }

            if (result.otpDelivery?.error) {
              setFeedback({ tone: 'warning', message: `Profil guncellendi fakat dogrulama kodu gonderilemedi. ${result.otpDelivery.error}` });
              return;
            }

            setFeedback({ tone: 'success', message: 'Profil bilgileriniz basariyla guncellendi.' });
          }}
        />
      )}
      {modal === 'password' && (
        <ChangePasswordModal onClose={() => setModal(null)} />
      )}
      {verificationPhone && (
        <PhoneVerificationModal
          initialStep="otp"
          initialPhoneNumber={verificationPhone}
          closeOnVerified
          onClose={() => setVerificationPhone(null)}
          onVerified={async () => {
            await refreshUser();
            await load();
            setVerificationPhone(null);
            setFeedback({ tone: 'success', message: 'Telefon numaraniz basariyla dogrulandi.' });
          }}
        />
      )}
    </div>
  );
}
