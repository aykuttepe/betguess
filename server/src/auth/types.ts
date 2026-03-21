import { Request } from 'express';

export type UserRole = 'user' | 'admin';
export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  title: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
  phoneNumber: string | null;
  phoneVerified: boolean;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export interface RefreshPayload {
  userId: number;
  type: 'refresh';
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
