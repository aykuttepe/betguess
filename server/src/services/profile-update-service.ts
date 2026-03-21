import bcrypt from 'bcrypt';
import { getDatabase } from '../db/database';
import {
  UserDetail,
  UserRow,
  findById,
  getUserDetail,
  usernameExists,
} from '../db/user-repository';
import { findByEmail } from '../db/user-repository';
import { arePhoneNumbersEquivalent, normalizePhoneNumber } from './phone-number';
import { dispatchWhatsAppOtp, DispatchOtpResult } from './otp-delivery';
import { whatsappService } from './whatsapp-service';
import { WhatsAppOtpDeliveryResult } from './whatsapp-status';

export interface UpdateOwnProfileInput {
  userId: number;
  username?: string;
  email?: string;
  phoneNumber?: string;
  title?: string | null;
  currentPassword?: string;
}

export interface UpdateOwnProfileResult {
  profile: UserDetail;
  otpSent: boolean;
  otpDelivery: WhatsAppOtpDeliveryResult | null;
}

interface PersistProfileChangesInput {
  userId: number;
  username: string;
  email: string;
  phoneNumber: string | null;
  phoneVerified: boolean;
  title: string | null;
}

export interface ProfileUpdateDeps {
  getCurrentUser: (userId: number) => UserRow | undefined;
  isUsernameTaken: (username: string) => boolean;
  findUserByEmail: (email: string) => UserRow | undefined;
  comparePassword: (plainText: string, passwordHash: string) => Promise<boolean>;
  persistChanges: (input: PersistProfileChangesInput) => void;
  loadProfile: (userId: number) => UserDetail | null;
  dispatchOtp: (phoneNumber: string, userId: number) => Promise<DispatchOtpResult>;
}

const defaultDeps: ProfileUpdateDeps = {
  getCurrentUser: findById,
  isUsernameTaken: usernameExists,
  findUserByEmail: findByEmail,
  comparePassword: (plainText, passwordHash) => bcrypt.compare(plainText, passwordHash),
  persistChanges: ({ userId, username, email, phoneNumber, phoneVerified, title }) => {
    const db = getDatabase();
    db.prepare(`
      UPDATE users
      SET username = ?, email = ?, phone_number = ?, phone_verified = ?, title = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(username, email, phoneNumber, phoneVerified ? 1 : 0, title, userId);
  },
  loadProfile: getUserDetail,
  dispatchOtp: (phoneNumber, userId) => dispatchWhatsAppOtp(phoneNumber, whatsappService, {
    targetKey: `phone_verification:${userId}`,
    purpose: 'phone_verification',
  }),
};

export async function updateOwnProfile(
  input: UpdateOwnProfileInput,
  deps: ProfileUpdateDeps = defaultDeps,
): Promise<UpdateOwnProfileResult> {
  const currentUser = deps.getCurrentUser(input.userId);
  if (!currentUser) {
    throw new Error('Kullanici bulunamadi.');
  }

  const nextUsername = input.username === undefined ? currentUser.username : input.username.trim();
  if (!nextUsername || nextUsername.length < 3 || nextUsername.length > 30 || !/^[a-zA-Z0-9_]+$/.test(nextUsername)) {
    throw new Error('Kullanici adi 3-30 karakter, harf, rakam ve alt cizgi icermelidir.');
  }

  const nextEmail = input.email === undefined ? currentUser.email : input.email.toLowerCase().trim();
  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    throw new Error('Gecerli bir e-posta adresi girin.');
  }

  let nextPhone = currentUser.phone_number;
  if (input.phoneNumber !== undefined) {
    const rawPhone = input.phoneNumber.trim();
    if (!rawPhone) {
      if (currentUser.phone_number) {
        throw new Error('Telefon numarasi bos birakilamaz.');
      }
      nextPhone = null;
    } else {
      const normalizedPhone = normalizePhoneNumber(rawPhone);
      if (!normalizedPhone.isValid || !normalizedPhone.normalizedPhone) {
        throw new Error(normalizedPhone.reason ?? 'Gecerli bir telefon numarasi girin.');
      }
      nextPhone = normalizedPhone.normalizedPhone;
    }
  }

  // Title: allow user to set/clear freely (max 50 chars)
  const nextTitle = input.title === undefined ? currentUser.title : (input.title ? input.title.trim().slice(0, 50) : null);
  const titleChanged = nextTitle !== currentUser.title;

  const usernameChanged = nextUsername !== currentUser.username;
  const emailChanged = nextEmail !== currentUser.email;
  const phoneChanged = !arePhoneNumbersEquivalent(nextPhone, currentUser.phone_number)
    && !(nextPhone === null && currentUser.phone_number === null);
  const criticalChanged = emailChanged || phoneChanged;

  if (usernameChanged && deps.isUsernameTaken(nextUsername)) {
    throw new Error('Bu kullanici adi zaten alinmis.');
  }

  if (emailChanged) {
    const existingUser = deps.findUserByEmail(nextEmail);
    if (existingUser && existingUser.id !== currentUser.id) {
      throw new Error('Bu e-posta adresi zaten kayitli.');
    }
  }

  if (criticalChanged) {
    if (!input.currentPassword?.trim()) {
      throw new Error('Kritik bilgileri degistirmek icin mevcut sifrenizi girin.');
    }

    const validPassword = await deps.comparePassword(input.currentPassword, currentUser.password_hash);
    if (!validPassword) {
      throw new Error('Mevcut sifre hatali.');
    }
  }

  if (usernameChanged || emailChanged || phoneChanged || titleChanged) {
    deps.persistChanges({
      userId: currentUser.id,
      username: nextUsername,
      email: nextEmail,
      phoneNumber: nextPhone,
      phoneVerified: phoneChanged ? false : currentUser.phone_verified === 1,
      title: nextTitle,
    });
  }

  let otpSent = false;
  let otpDelivery: WhatsAppOtpDeliveryResult | null = null;

  if (phoneChanged && nextPhone) {
    const dispatchResult = await deps.dispatchOtp(nextPhone, currentUser.id);
    otpSent = dispatchResult.otpSent;
    otpDelivery = dispatchResult.otpDelivery;
  }

  const profile = deps.loadProfile(currentUser.id);
  if (!profile) {
    throw new Error('Guncel profil bilgisi alinamadi.');
  }

  return {
    profile,
    otpSent,
    otpDelivery,
  };
}
