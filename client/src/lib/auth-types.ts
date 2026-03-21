export type UserRole = 'user' | 'admin';
export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface User {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  title: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
}

export interface AdminUserRow {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  title: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUserDetail {
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
  createdAt: string;
  updatedAt: string;
  couponCount: number;
  lastCouponAt: string | null;
}
