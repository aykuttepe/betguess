import { User, AdminUserRow, AdminUserDetail } from './auth-types';
import { apiFetchJson, HttpApiError } from './http';

const BASE = '/api/auth';
const ADMIN_BASE = '/api/admin';

export type WhatsAppStatus = 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED';
export type WhatsAppOtpFailureReason =
  | 'WHATSAPP_NOT_READY'
  | 'INVALID_PHONE_NUMBER'
  | 'WHATSAPP_ACCOUNT_NOT_FOUND'
  | 'SEND_FAILED';

interface ApiErrorPayload {
  error?: string;
  code?: string;
  retryable?: boolean;
  whatsappStatus?: WhatsAppStatus;
  normalizedPhone?: string | null;
  reason?: WhatsAppOtpFailureReason;
  lastError?: string | null;
}

export interface WhatsAppStatusResponse {
  status: WhatsAppStatus;
  qrCode: string | null;
  isReadyForOtp: boolean;
  summary: string;
  lastError: string | null;
  lastTransitionAt: string | null;
  botPhoneNumber: string | null;
}

export interface OtpDeliveryResult {
  sent: boolean;
  reason: WhatsAppOtpFailureReason | null;
  error: string | null;
  whatsappStatus: WhatsAppStatus;
  normalizedPhone: string | null;
  retryable: boolean;
}

export interface RegisterResponse {
  user: User;
  otpDelivery: OtpDeliveryResult | null;
}

export interface UpdateProfilePayload {
  username?: string;
  email?: string;
  phoneNumber?: string;
  title?: string | null;
  currentPassword?: string;
}

export interface UpdateProfileResponse {
  profile: AdminUserDetail;
  otpSent: boolean;
  otpDelivery: OtpDeliveryResult | null;
}

export class AuthApiError extends Error {
  status: number;
  code?: string;
  retryable?: boolean;
  whatsappStatus?: WhatsAppStatus;
  normalizedPhone?: string | null;
  reason?: WhatsAppOtpFailureReason;
  lastError?: string | null;

  constructor(message: string, status: number, payload: ApiErrorPayload = {}) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = payload.code;
    this.retryable = payload.retryable;
    this.whatsappStatus = payload.whatsappStatus;
    this.normalizedPhone = payload.normalizedPhone;
    this.reason = payload.reason;
    this.lastError = payload.lastError;
  }
}

async function authFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    return await apiFetchJson<T>(url, options, {
      defaultError: 'Baglanti hatasi',
      redirectOn401: false,
    });
  } catch (error) {
    if (error instanceof HttpApiError) {
      throw new AuthApiError(error.message, error.status, error.payload as ApiErrorPayload);
    }

    throw error;
  }
}

export async function apiRegister(email: string, username: string, password: string, phoneNumber?: string): Promise<RegisterResponse> {
  return authFetch<RegisterResponse>(`${BASE}/register`, {
    method: 'POST',
    body: JSON.stringify({ email, username, password, phoneNumber }),
  });
}

export async function apiForgotPassword(email: string, phoneNumber: string): Promise<{ message: string }> {
  return authFetch<{ message: string }>(`${BASE}/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email, phoneNumber }),
  });
}

export async function apiResetPassword(email: string, phoneNumber: string, code: string, newPassword: string): Promise<{ message: string }> {
  return authFetch<{ message: string }>(`${BASE}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ email, phoneNumber, code, newPassword }),
  });
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const data = await authFetch<{ user: User }>(`${BASE}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function apiLogout(): Promise<void> {
  await authFetch(`${BASE}/logout`, { method: 'POST' });
}

export async function apiGetMe(): Promise<User> {
  const data = await authFetch<{ user: User }>(`${BASE}/me`);
  return data.user;
}

// Profile APIs
export async function apiGetProfile(): Promise<AdminUserDetail> {
  return apiFetchJson<AdminUserDetail>(`${BASE}/profile`, {}, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiUpdateProfile(data: UpdateProfilePayload): Promise<UpdateProfileResponse> {
  return apiFetchJson<UpdateProfileResponse>(`${BASE}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiFetchJson<{ message: string }>(`${BASE}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

// Admin APIs
export async function apiGetUserDetail(userId: number): Promise<AdminUserDetail> {
  return apiFetchJson<AdminUserDetail>(`${ADMIN_BASE}/users/${userId}`, {}, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiListUsers(): Promise<AdminUserRow[]> {
  const data = await apiFetchJson<{ users: AdminUserRow[] }>(`${ADMIN_BASE}/users`, {}, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
  return data.users;
}

export async function apiUpdateRole(userId: number, role: string): Promise<void> {
  await apiFetchJson(`${ADMIN_BASE}/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiUpdateTitle(userId: number, title: string | null): Promise<void> {
  await apiFetchJson(`${ADMIN_BASE}/users/${userId}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiUpdateSubscription(userId: number, tier: string, expiresAt: string | null): Promise<void> {
  await apiFetchJson(`${ADMIN_BASE}/users/${userId}/subscription`, {
    method: 'PATCH',
    body: JSON.stringify({ tier, expiresAt }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiSetActive(userId: number, isActive: boolean): Promise<void> {
  await apiFetchJson(`${ADMIN_BASE}/users/${userId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiAdminResetPassword(userId: number, newPassword: string): Promise<{ message: string }> {
  return apiFetchJson<{ message: string }>(`${ADMIN_BASE}/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  freeCount: number;
  proCount: number;
  premiumCount: number;
  recentUsers: Array<{ id: number; username: string; email: string; role: string; createdAt: string }>;
}

export async function apiGetStats(): Promise<AdminStats> {
  return apiFetchJson<AdminStats>(`${ADMIN_BASE}/stats`, {}, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiGetWhatsAppStatus(): Promise<WhatsAppStatusResponse> {
  return apiFetchJson<WhatsAppStatusResponse>(`${ADMIN_BASE}/whatsapp/status`, {}, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

// ─── Phone verification APIs ────────────────────────────────────────────────

export interface WhatsAppInfoResponse {
  isReady: boolean;
  botPhoneNumber: string | null;
}

export async function apiGetWhatsAppInfo(): Promise<WhatsAppInfoResponse> {
  return apiFetchJson<WhatsAppInfoResponse>(`${BASE}/whatsapp-info`, {}, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiUpdatePhone(phoneNumber: string): Promise<{ message: string; otpSent: boolean; otpDelivery?: OtpDeliveryResult }> {
  return apiFetchJson<{ message: string; otpSent: boolean; otpDelivery?: OtpDeliveryResult }>(`${BASE}/update-phone`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiSendVerificationOtp(): Promise<{ message: string }> {
  return apiFetchJson<{ message: string }>(`${BASE}/send-verification-otp`, {
    method: 'POST',
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function apiVerifyPhone(code: string): Promise<{ message: string }> {
  return apiFetchJson<{ message: string }>(`${BASE}/verify-phone`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}
