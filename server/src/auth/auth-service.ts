import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthUser, JwtPayload, RefreshPayload, UserRole, SubscriptionTier } from './types';
import { UserRow, createUser, findByEmail, findById, emailExists, usernameExists } from '../db/user-repository';
import { normalizePhoneNumber } from '../services/phone-number';

const JWT_SECRET = process.env.JWT_SECRET || 'betguess-dev-secret-change-in-prod';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const BCRYPT_ROUNDS = 10;

function userRowToAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role as UserRole,
    title: row.title,
    subscriptionTier: row.subscription_tier as SubscriptionTier,
    subscriptionExpiresAt: row.subscription_expires_at,
    isActive: row.is_active === 1,
    phoneNumber: row.phone_number,
    phoneVerified: row.phone_verified === 1,
  };
}

export function toPublicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    title: user.title,
    subscriptionTier: user.subscriptionTier,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    phoneNumber: user.phoneNumber,
    phoneVerified: user.phoneVerified,
  };
}

export async function register(email: string, username: string, password: string, phoneNumber: string | null = null): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  email = email.toLowerCase().trim();
  username = username.trim();
  let normalizedPhoneNumber: string | null = null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Gecerli bir e-posta adresi girin.');
  }
  if (!username || username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error('Kullanici adi 3-30 karakter, harf, rakam ve alt cizgi icermelidir.');
  }
  if (!password || password.length < 6) {
    throw new Error('Sifre en az 6 karakter olmalidir.');
  }
  if (emailExists(email)) {
    throw new Error('Bu e-posta adresi zaten kayitli.');
  }
  if (usernameExists(username)) {
    throw new Error('Bu kullanici adi zaten alinmis.');
  }

  if (phoneNumber) {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized.isValid || !normalized.normalizedPhone) {
      throw new Error(normalized.reason ?? 'Gecerli bir telefon numarasi girin.');
    }

    normalizedPhoneNumber = normalized.normalizedPhone;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const row = createUser(email, username, passwordHash, 'user', normalizedPhoneNumber);
  const user = userRowToAuthUser(row);
  const { accessToken, refreshToken } = generateTokens(user);

  return { user, accessToken, refreshToken };
}

export async function login(email: string, password: string): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  email = email.toLowerCase().trim();

  if (!email || !password) {
    throw new Error('E-posta ve sifre gereklidir.');
  }

  const row = findByEmail(email);
  if (!row) {
    throw new Error('E-posta veya sifre hatali.');
  }

  if (row.is_active === 0) {
    throw new Error('Hesabiniz devre disi birakilmis. Yonetici ile iletisime gecin.');
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw new Error('E-posta veya sifre hatali.');
  }

  const user = userRowToAuthUser(row);
  const { accessToken, refreshToken } = generateTokens(user);

  return { user, accessToken, refreshToken };
}

export function generateTokens(user: AuthUser): { accessToken: string; refreshToken: string } {
  const accessPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const refreshPayload: RefreshPayload = {
    userId: user.id,
    type: 'refresh',
  };

  const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const payload = jwt.verify(token, JWT_SECRET) as RefreshPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Gecersiz refresh token.');
  }
  return payload;
}

export function getUserById(id: number): AuthUser | null {
  const row = findById(id);
  if (!row) return null;
  return userRowToAuthUser(row);
}
