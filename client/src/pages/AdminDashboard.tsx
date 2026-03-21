import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AdminUserRow, AdminUserDetail } from '../lib/auth-types';
import {
  AdminStats,
  WhatsAppStatusResponse,
  apiGetStats,
  apiGetWhatsAppStatus,
  apiListUsers,
  apiGetUserDetail,
  apiUpdateRole,
  apiUpdateTitle,
  apiUpdateSubscription,
  apiSetActive,
  apiAdminResetPassword,
} from '../lib/auth-api';

// ─── CustomSelect ────────────────────────────────────────────────────────────
function CustomSelect<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div className="adm-custom-select" ref={ref}>
      <button
        type="button"
        className={`adm-custom-select-btn ${open ? 'adm-custom-select-open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>{selected.label}</span>
        <svg className="adm-select-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <ul className="adm-custom-select-menu">
          {options.map((opt) => (
            <li
              key={opt.value}
              className={`adm-custom-select-item ${opt.value === value ? 'adm-custom-select-item-active' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string | null) {
  if (!d) {
    return 'Henüz yok';
  }

  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleBadge(role: string) {
  return role === 'admin'
    ? <span className="adm-badge adm-badge-admin">★ Admin</span>
    : <span className="adm-badge adm-badge-user">• Kullanıcı</span>;
}

function tierBadge(tier: string) {
  const m: Record<string, string> = { free: 'adm-badge-free', pro: 'adm-badge-pro', premium: 'adm-badge-premium' };
  const l: Record<string, string> = { free: 'Ücretsiz', pro: 'Pro', premium: 'Premium' };
  return <span className={`adm-badge ${m[tier] ?? 'adm-badge-free'}`}>{l[tier] ?? tier}</span>;
}

function activeBadge(isActive: boolean) {
  return isActive
    ? <span className="adm-badge adm-badge-active">● Aktif</span>
    : <span className="adm-badge adm-badge-inactive">○ Pasif</span>;
}

function getWhatsAppOverviewCardClasses(status: WhatsAppStatusResponse['status']) {
  if (status === 'QR_READY' || status === 'INITIALIZING') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }

  return 'border-red-500/30 bg-red-500/10 text-red-100';
}

function getWhatsAppOverviewIcon(status: WhatsAppStatusResponse['status']) {
  if (status === 'QR_READY') {
    return '📱';
  }

  if (status === 'INITIALIZING' || status === 'AUTHENTICATED') {
    return '⏳';
  }

  return '⚠️';
}

// ─── StatCard ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={`adm-stat-card adm-stat-${color}`}>
      <span className="adm-stat-icon">{icon}</span>
      <div className="adm-stat-body">
        <p className="adm-stat-value">{value}</p>
        <p className="adm-stat-label">{label}</p>
      </div>
    </div>
  );
}

// ─── UserDetailModal ──────────────────────────────────────────────────────────
interface DetailModalProps {
  userId: number;
  onClose: () => void;
  onEdit: (user: AdminUserRow) => void;
  onResetPassword: (user: { id: number; username: string }) => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="adm-detail-row">
      <span className="adm-detail-label">{label}</span>
      <span className="adm-detail-value">{children}</span>
    </div>
  );
}

function useBodyScrollLock() {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTop = document.body.style.top;
    const prevPosition = document.body.style.position;
    const prevWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

function UserDetailModal({ userId, onClose, onEdit, onResetPassword }: DetailModalProps) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useBodyScrollLock();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiGetUserDetail(userId)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Detay yüklenemedi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  function handleEdit() {
    if (!detail) return;
    onEdit({
      id: detail.id,
      email: detail.email,
      username: detail.username,
      role: detail.role,
      title: detail.title,
      subscriptionTier: detail.subscriptionTier,
      subscriptionExpiresAt: detail.subscriptionExpiresAt,
      isActive: detail.isActive,
      createdAt: detail.createdAt,
    });
  }

  return createPortal(
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="adm-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {detail && (
              <div className="adm-avatar" style={{ width: 44, height: 44, fontSize: '1.1rem' }}>
                {detail.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="adm-modal-title">Kullanıcı Detayı</h2>
              {detail && <p className="adm-modal-sub">{detail.username} · #{detail.id}</p>}
            </div>
          </div>
          <button className="adm-modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        {/* Body */}
        <div className="adm-modal-body adm-detail-body">
          {loading ? (
            <div className="adm-loading" style={{ padding: '3rem 0' }}><span className="adm-guard-spinner" />Yükleniyor…</div>
          ) : error ? (
            <div className="adm-modal-error" style={{ margin: '1.25rem 1.5rem' }}>{error}</div>
          ) : detail ? (
            <>
              {/* Badges row */}
              <div className="adm-detail-badges">
                {roleBadge(detail.role)}
                {tierBadge(detail.subscriptionTier)}
                {activeBadge(detail.isActive)}
                {detail.phoneVerified && (
                  <span className="adm-badge adm-badge-active">✓ Tel Doğrulandı</span>
                )}
                {detail.phoneNumber && !detail.phoneVerified && (
                  <span className="adm-badge adm-badge-inactive">✗ Tel Doğrulanmadı</span>
                )}
              </div>

              {/* Info sections */}
              <div className="adm-detail-section">
                <h3 className="adm-detail-section-title">Hesap Bilgileri</h3>
                <DetailRow label="E-posta">{detail.email}</DetailRow>
                <DetailRow label="Kullanıcı Adı">{detail.username}</DetailRow>
                {detail.title && <DetailRow label="Ünvan">{detail.title}</DetailRow>}
                <DetailRow label="Telefon">
                  {detail.phoneNumber ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {detail.phoneNumber}
                      {detail.phoneVerified
                        ? <span style={{ color: '#10b981', fontSize: '0.75rem' }}>✓ Doğrulandı</span>
                        : <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>Doğrulanmadı</span>
                      }
                    </span>
                  ) : (
                    <span style={{ color: '#4b5563' }}>Girilmemiş</span>
                  )}
                </DetailRow>
              </div>

              <div className="adm-detail-section">
                <h3 className="adm-detail-section-title">Abonelik</h3>
                <DetailRow label="Plan">{tierBadge(detail.subscriptionTier)}</DetailRow>
                {detail.subscriptionExpiresAt && (
                  <DetailRow label="Bitiş Tarihi">
                    {fmtDate(detail.subscriptionExpiresAt)}
                    {new Date(detail.subscriptionExpiresAt) < new Date() && (
                      <span className="adm-badge adm-badge-inactive" style={{ marginLeft: '0.5rem' }}>Süresi Dolmuş</span>
                    )}
                  </DetailRow>
                )}
              </div>

              <div className="adm-detail-section">
                <h3 className="adm-detail-section-title">Aktivite</h3>
                <DetailRow label="Kupon Sayısı">
                  <span style={{ fontWeight: 600, color: detail.couponCount > 0 ? '#60a5fa' : '#4b5563' }}>
                    {detail.couponCount}
                  </span>
                </DetailRow>
                {detail.lastCouponAt && (
                  <DetailRow label="Son Kupon">{fmtDate(detail.lastCouponAt)}</DetailRow>
                )}
                <DetailRow label="Kayıt Tarihi">{fmtDate(detail.createdAt)}</DetailRow>
                <DetailRow label="Son Güncelleme">{fmtDate(detail.updatedAt)}</DetailRow>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="adm-modal-footer">
          <button className="adm-btn adm-btn-ghost" onClick={onClose}>Kapat</button>
          {detail && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="adm-btn adm-btn-outline"
                onClick={() => onResetPassword({ id: detail.id, username: detail.username })}
              >
                🔑 Şifre Sıfırla
              </button>
              <button className="adm-btn adm-btn-edit" onClick={handleEdit}>
                ✎ Düzenle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── ResetPasswordModal ──────────────────────────────────────────────────────
interface ResetPwModalProps {
  user: { id: number; username: string };
  onClose: () => void;
}

function ResetPasswordModal({ user, onClose }: ResetPwModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useBodyScrollLock();

  async function handleReset() {
    setError('');
    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setSaving(true);
    try {
      const result = await apiAdminResetPassword(user.id, newPassword);
      setSuccess(result.message);
      setTimeout(onClose, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal" style={{ maxWidth: 420 }}>
        <div className="adm-modal-header">
          <div>
            <h2 className="adm-modal-title">Şifre Sıfırla</h2>
            <p className="adm-modal-sub">{user.username} · #{user.id}</p>
          </div>
          <button className="adm-modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        <div className="adm-modal-body">
          <label className="adm-field-label">Yeni Şifre</label>
          <input
            className="adm-input"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="En az 6 karakter"
            autoFocus
          />
          <label className="adm-field-label">Yeni Şifre (Tekrar)</label>
          <input
            className="adm-input"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Şifreyi tekrar girin"
            onKeyDown={e => e.key === 'Enter' && handleReset()}
          />
          {error && <p className="adm-modal-error">{error}</p>}
          {success && (
            <p style={{ color: '#10b981', fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, margin: 0 }}>
              {success}
            </p>
          )}
        </div>
        <div className="adm-modal-footer">
          <button className="adm-btn adm-btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
          <button className="adm-btn adm-btn-primary" onClick={handleReset} disabled={saving || !!success}>
            {saving ? <span className="adm-mini-spinner" /> : 'Şifreyi Sıfırla'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── EditUserModal ────────────────────────────────────────────────────────────
interface EditModalProps {
  user: AdminUserRow;
  currentUserId: number;
  onClose: () => void;
  onSaved: () => void;
}

function EditUserModal({ user, currentUserId, onClose, onSaved }: EditModalProps) {
  const [role, setRole] = useState(user.role);
  const [title, setTitle] = useState(user.title ?? '');
  const [tier, setTier] = useState(user.subscriptionTier);
  const [expiresAt, setExpiresAt] = useState(user.subscriptionExpiresAt ?? '');
  const [isActive, setIsActive] = useState(user.isActive);
  const [saving, setSaving] = useState(false);

  useBodyScrollLock();
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const promises: Promise<void>[] = [];

      if (role !== user.role) promises.push(apiUpdateRole(user.id, role));
      if ((title || null) !== (user.title ?? null)) promises.push(apiUpdateTitle(user.id, title || null));
      if (tier !== user.subscriptionTier || (expiresAt || null) !== (user.subscriptionExpiresAt ?? null))
        promises.push(apiUpdateSubscription(user.id, tier, expiresAt || null));
      if (isActive !== user.isActive && user.id !== currentUserId)
        promises.push(apiSetActive(user.id, isActive));

      await Promise.all(promises);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal">
        <div className="adm-modal-header">
          <div>
            <h2 className="adm-modal-title">Kullanıcı Düzenle</h2>
            <p className="adm-modal-sub">{user.username} · {user.email}</p>
          </div>
          <button className="adm-modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className="adm-modal-body">
          {/* Role */}
          <label className="adm-field-label">Rol</label>
          <div className="adm-role-toggle">
            {(['user', 'admin'] as const).map(r => (
              <button
                key={r}
                type="button"
                disabled={r !== 'admin' && user.id === currentUserId}
                onClick={() => setRole(r)}
                className={`adm-role-btn ${role === r ? 'adm-role-btn-active' : ''}`}
              >
                {r === 'admin' ? '★ Admin' : '• Kullanıcı'}
              </button>
            ))}
          </div>

          {/* Title */}
          <label className="adm-field-label">Unvan <span className="adm-field-opt">(isteğe bağlı)</span></label>
          <input
            className="adm-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="örn: Analist, Editör..."
          />

          {/* Subscription */}
          <label className="adm-field-label">Abonelik</label>
          <div className="adm-tier-toggle">
            {(['free', 'pro', 'premium'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`adm-tier-btn adm-tier-btn-${t} ${tier === t ? 'adm-tier-btn-active' : ''}`}
              >
                {t === 'free' ? 'Ücretsiz' : t === 'pro' ? 'Pro' : 'Premium'}
              </button>
            ))}
          </div>

          {tier !== 'free' && (
            <div className="adm-expires-wrap">
              <label className="adm-field-label">Bitiş Tarihi</label>
              <input
                type="date"
                className="adm-input"
                value={expiresAt ? expiresAt.split('T')[0] : ''}
                onChange={e => setExpiresAt(e.target.value)}
              />
            </div>
          )}

          {/* Active toggle */}
          {user.id !== currentUserId && (
            <div className="adm-active-row">
              <span className="adm-field-label" style={{ margin: 0 }}>Hesap Durumu</span>
              <button
                type="button"
                onClick={() => setIsActive((v: boolean) => !v)}
                className={`adm-toggle ${isActive ? 'adm-toggle-on' : ''}`}
                aria-checked={isActive}
                role="switch"
              >
                <span className="adm-toggle-thumb" />
              </button>
              <span className={isActive ? 'adm-toggle-label-on' : 'adm-toggle-label-off'}>
                {isActive ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          )}

          {error && <p className="adm-modal-error">{error}</p>}
        </div>

        <div className="adm-modal-footer">
          <button className="adm-btn adm-btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
          <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="adm-mini-spinner" /> : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
type Tab = 'overview' | 'users' | 'whatsapp';

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [usersError, setUsersError] = useState('');
  const [editTarget, setEditTarget] = useState<AdminUserRow | null>(null);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<{ id: number; username: string } | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [waStatus, setWaStatus] = useState<WhatsAppStatusResponse | null>(null);
  const [loadingWa, setLoadingWa] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true });
  }, [isAdmin, navigate]);

  // Load stats
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError('');
    try {
      setStats(await apiGetStats());
    } catch (e: unknown) {
      setStatsError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi.');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError('');
    try {
      setUsers(await apiListUsers());
    } catch (e: unknown) {
      setUsersError(e instanceof Error ? e.message : 'Kullanıcılar yüklenemedi.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadWaStatus = useCallback(async () => {
    setLoadingWa(true);
    try {
      setWaStatus(await apiGetWhatsAppStatus());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWa(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    loadWaStatus();
    const interval = setInterval(loadWaStatus, 15000);
    return () => clearInterval(interval);
  }, [loadWaStatus]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);

  // Filtered users
  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? u.isActive : !u.isActive);
    return matchSearch && matchRole && matchStatus;
  });

  if (!isAdmin) return null;

  return (
    <div className="adm-root">
      {/* Header */}
      <div className="adm-header">
        <div className="adm-header-left">
          <span className="adm-header-icon">⚙</span>
          <div>
            <h1 className="adm-header-title">Admin Dashboard</h1>
            <p className="adm-header-sub">Merhaba, <strong>{user?.username}</strong></p>
          </div>
        </div>
        <div className="adm-tabs">
          {(['overview', 'users', 'whatsapp'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`adm-tab ${tab === t ? 'adm-tab-active' : ''}`}
            >
              {t === 'overview' ? '📊 Genel Bakış' : t === 'users' ? '👥 Kullanıcılar' : '🤖 WhatsApp Bot'}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ─── */}
      {tab === 'overview' && (
        <div className="adm-section adm-fade-in">
          {loadingStats ? (
            <div className="adm-loading"><span className="adm-guard-spinner" />Yükleniyor…</div>
          ) : statsError ? (
            <div className="adm-error-msg">{statsError}</div>
          ) : stats ? (
            <>
              {/* Stat cards */}
              <div className="adm-stats-grid">
                <StatCard label="Toplam Kullanıcı" value={stats.totalUsers} icon="👤" color="blue" />
                <StatCard label="Aktif Kullanıcı" value={stats.activeUsers} icon="✅" color="green" />
                <StatCard label="Admin Sayısı" value={stats.adminCount} icon="★" color="yellow" />
                <StatCard label="Premium Üye" value={stats.premiumCount} icon="💎" color="purple" />
              </div>

              {waStatus && !waStatus.isReadyForOtp && (
                <div className={`adm-card border ${getWhatsAppOverviewCardClasses(waStatus.status)}`}>
                  <div className="adm-card-header">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getWhatsAppOverviewIcon(waStatus.status)}</span>
                      <div>
                        <h2 className="adm-card-title text-inherit">WhatsApp OTP servisi hazir degil</h2>
                        <p className="text-sm opacity-90">{waStatus.summary}</p>
                        {waStatus.lastError && (
                          <p className="text-sm mt-2 opacity-90">Son hata: {waStatus.lastError}</p>
                        )}
                        {waStatus.status === 'QR_READY' && (
                          <p className="text-sm font-semibold mt-2">QR kodu okutulmadan sifre sifirlama calismaz.</p>
                        )}
                      </div>
                    </div>
                    <button className="adm-btn adm-btn-sm adm-btn-ghost" onClick={() => setTab('whatsapp')}>
                      WhatsApp Sekmesine Git
                    </button>
                  </div>
                </div>
              )}

              {/* Subscription breakdown */}
              <div className="adm-card">
                <h2 className="adm-card-title">Abonelik Dağılımı</h2>
                <div className="adm-sub-bars">
                  {[
                    { label: 'Ücretsiz', count: stats.freeCount, total: stats.totalUsers, cls: 'adm-bar-free' },
                    { label: 'Pro', count: stats.proCount, total: stats.totalUsers, cls: 'adm-bar-pro' },
                    { label: 'Premium', count: stats.premiumCount, total: stats.totalUsers, cls: 'adm-bar-premium' },
                  ].map(({ label, count, total, cls }) => (
                    <div key={label} className="adm-sub-bar-row">
                      <span className="adm-sub-bar-label">{label}</span>
                      <div className="adm-sub-bar-track">
                        <div
                          className={`adm-sub-bar-fill ${cls}`}
                          style={{ width: total ? `${(count / total) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="adm-sub-bar-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent users */}
              <div className="adm-card">
                <div className="adm-card-header">
                  <h2 className="adm-card-title">Son Kayıtlar</h2>
                  <button className="adm-btn adm-btn-sm adm-btn-ghost" onClick={() => setTab('users')}>
                    Tümünü Gör →
                  </button>
                </div>
                <div className="adm-recent-list">
                  {stats.recentUsers.length === 0 ? (
                    <p className="adm-empty">Henüz kullanıcı yok.</p>
                  ) : stats.recentUsers.map(u => (
                    <div key={u.id} className="adm-recent-row">
                      <div className="adm-avatar">{u.username.charAt(0).toUpperCase()}</div>
                      <div className="adm-recent-info">
                        <p className="adm-recent-name">{u.username}</p>
                        <p className="adm-recent-email">{u.email}</p>
                      </div>
                      {roleBadge(u.role)}
                      <span className="adm-recent-date">{fmtDate(u.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── USERS TAB ─── */}
      {tab === 'users' && (
        <div className="adm-section adm-fade-in">
          {/* Toolbar */}
          <div className="adm-toolbar">
            <div className="adm-search-wrap">
              <span className="adm-search-icon">🔍</span>
              <input
                className="adm-search"
                placeholder="İsim veya e-posta ara…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <CustomSelect
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { value: 'all', label: 'Tüm Roller' },
                { value: 'admin', label: 'Admin' },
                { value: 'user', label: 'Kullanıcı' },
              ]}
            />
            <CustomSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: 'all', label: 'Tüm Durumlar' },
                { value: 'active', label: 'Aktif' },
                { value: 'inactive', label: 'Pasif' },
              ]}
            />
            <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={loadUsers} disabled={loadingUsers}>
              {loadingUsers ? <span className="adm-mini-spinner" /> : '↻ Yenile'}
            </button>
          </div>

          {loadingUsers ? (
            <div className="adm-loading"><span className="adm-guard-spinner" />Yükleniyor…</div>
          ) : usersError ? (
            <div className="adm-error-msg">{usersError}</div>
          ) : (
            <>
              <p className="adm-count">{filteredUsers.length} kullanıcı gösteriliyor</p>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Kullanıcı</th>
                      <th>Rol</th>
                      <th>Abonelik</th>
                      <th>Durum</th>
                      <th>Kayıt T.</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={6} className="adm-empty">Eşleşen kullanıcı bulunamadı.</td></tr>
                    ) : filteredUsers.map(u => (
                      <tr
                        key={u.id}
                        className={`adm-row-clickable ${!u.isActive ? 'adm-row-inactive' : ''}`}
                        onClick={() => setDetailUserId(u.id)}
                      >
                        <td>
                          <div className="adm-user-cell">
                            <div className="adm-avatar">{u.username.charAt(0).toUpperCase()}</div>
                            <div>
                              <p className="adm-cell-name">{u.username}</p>
                              <p className="adm-cell-email">{u.email}</p>
                              {u.title && <p className="adm-cell-title">{u.title}</p>}
                            </div>
                          </div>
                        </td>
                        <td>{roleBadge(u.role)}</td>
                        <td>{tierBadge(u.subscriptionTier)}</td>
                        <td>{activeBadge(u.isActive)}</td>
                        <td className="adm-cell-date">{fmtDate(u.createdAt)}</td>
                        <td className="adm-cell-actions">
                          <button
                            className="adm-btn adm-btn-sm adm-btn-ghost"
                            onClick={(e) => { e.stopPropagation(); setDetailUserId(u.id); }}
                          >
                            Detay
                          </button>
                          <button
                            className="adm-btn adm-btn-sm adm-btn-edit"
                            style={{ marginLeft: '0.375rem' }}
                            onClick={(e) => { e.stopPropagation(); setEditTarget(u); }}
                          >
                            Düzenle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WHATSAPP TAB ─── */}
      {tab === 'whatsapp' && (
        <div className="adm-section adm-fade-in">
          <div className="adm-card">
            <div className="adm-card-header">
              <h2 className="adm-card-title">WhatsApp Bot Durumu</h2>
              <button className="adm-btn adm-btn-sm adm-btn-ghost" onClick={loadWaStatus} disabled={loadingWa}>
                  {loadingWa ? <span className="adm-mini-spinner" /> : '↻ Yenile'}
              </button>
            </div>
            
            <div className="p-4 bg-gray-900 rounded-lg text-center mt-4">
              {loadingWa && !waStatus ? (
                <div className="text-gray-400 py-10">Durum sorgulanıyor...</div>
              ) : waStatus ? (
                <div>
                  <div className="mb-6 flex justify-center">
                    {waStatus.status === 'READY' && (
                      <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-xl flex items-center gap-3">
                        <span className="text-2xl">✅</span>
                        <div className="text-left">
                          <p className="font-bold">Bağlandı ve Hazır</p>
                          <p className="text-sm opacity-80">{waStatus.summary}</p>
                        </div>
                      </div>
                    )}
                    {waStatus.status === 'AUTHENTICATED' && (
                      <div className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-6 py-3 rounded-xl flex items-center gap-3">
                        <span className="text-2xl animate-spin">⏳</span>
                        <div className="text-left">
                          <p className="font-bold">Kimlik Doğrulandı</p>
                          <p className="text-sm opacity-80">{waStatus.summary}</p>
                        </div>
                      </div>
                    )}
                    {waStatus.status === 'INITIALIZING' && (
                      <div className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-6 py-3 rounded-xl flex items-center gap-3">
                        <span className="text-2xl animate-pulse">⚙️</span>
                        <div className="text-left">
                          <p className="font-bold">Başlatılıyor</p>
                          <p className="text-sm opacity-80">{waStatus.summary}</p>
                        </div>
                      </div>
                    )}
                    {waStatus.status === 'DISCONNECTED' && (
                      <div className="bg-red-500/10 text-red-400 border border-red-500/30 px-6 py-3 rounded-xl flex items-center gap-3">
                        <span className="text-2xl">❌</span>
                        <div className="text-left">
                          <p className="font-bold">Bağlantı Koptu</p>
                          <p className="text-sm opacity-80">{waStatus.summary}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {waStatus.status === 'QR_READY' && waStatus.qrCode && (
                    <div className="bg-gray-800 p-6 rounded-xl inline-block max-w-sm w-full mx-auto shadow-2xl border border-gray-700">
                      <h3 className="text-lg font-bold text-white mb-2">WhatsApp Web ile Tara</h3>
                      <p className="text-gray-400 text-sm mb-6">Telefonunuzdaki WhatsApp'ı açın, Ayarlar &gt; Bağlı Cihazlar menüsünden bu karekodu okutun.</p>
                      
                      <div className="bg-white p-4 rounded-xl flex justify-center mb-4">
                        <img src={waStatus.qrCode} alt="WhatsApp QR Code" className="w-64 h-64 shadow-inner" />
                      </div>
                      <p className="text-amber-500 text-xs mt-2">*Karekod {new Date().toLocaleTimeString()} itibarıyla üretildi. Karekodun süresi dolarsa paneli yenileyin.</p>
                    </div>
                  )}

                  <div className="mt-6 grid gap-3 text-left max-w-2xl mx-auto">
                    <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Bot Numarasi</p>
                      <p className="text-sm text-gray-200">{waStatus.botPhoneNumber ?? 'Henüz algilanmadi'}</p>
                    </div>
                    <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Son Durum Gecisi</p>
                      <p className="text-sm text-gray-200">{fmtDateTime(waStatus.lastTransitionAt)}</p>
                    </div>
                    <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Son Hata</p>
                      <p className="text-sm text-gray-200">{waStatus.lastError ?? 'Yok'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-red-400 py-10">Durum bilgisi alınamadı. Sunucu kapalı olabilir.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailUserId !== null && (
        <UserDetailModal
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onEdit={(u) => {
            setDetailUserId(null);
            setEditTarget(u);
          }}
          onResetPassword={(u) => {
            setDetailUserId(null);
            setResetPwTarget(u);
          }}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          currentUserId={user!.id}
          onClose={() => setEditTarget(null)}
          onSaved={() => { loadUsers(); loadStats(); }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPwTarget && (
        <ResetPasswordModal
          user={resetPwTarget}
          onClose={() => setResetPwTarget(null)}
        />
      )}
    </div>
  );
}
