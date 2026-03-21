import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileUpdateDeps, updateOwnProfile } from './profile-update-service';
import { createWhatsAppDeliveryResult } from './whatsapp-status';

function createDeps(overrides: Partial<ProfileUpdateDeps> = {}): ProfileUpdateDeps {
  const state = {
    persisted: null as null | {
      userId: number;
      username: string;
      email: string;
      phoneNumber: string | null;
      phoneVerified: boolean;
    },
  };

  const currentUser = {
    id: 1,
    email: 'test@test.com',
    username: 'testuser',
    password_hash: 'hashed',
    role: 'user',
    title: null,
    subscription_tier: 'free',
    subscription_expires_at: null,
    is_active: 1,
    phone_number: '905551234567',
    phone_verified: 1,
    created_at: '2026-03-20 10:00:00',
    updated_at: '2026-03-20 10:00:00',
  };

  const deps: ProfileUpdateDeps = {
    getCurrentUser: () => currentUser,
    isUsernameTaken: () => false,
    findUserByEmail: () => undefined,
    comparePassword: async (plainText) => plainText === 'correct-password',
    persistChanges: (input) => {
      state.persisted = input;
    },
    loadProfile: () => ({
      id: 1,
      email: state.persisted?.email ?? currentUser.email,
      username: state.persisted?.username ?? currentUser.username,
      role: 'user',
      title: null,
      subscriptionTier: 'free',
      subscriptionExpiresAt: null,
      isActive: true,
      phoneNumber: state.persisted?.phoneNumber ?? currentUser.phone_number,
      phoneVerified: state.persisted?.phoneVerified ?? true,
      createdAt: '2026-03-20 10:00:00',
      updatedAt: '2026-03-20 11:00:00',
      couponCount: 0,
      lastCouponAt: null,
    }),
    dispatchOtp: async (phoneNumber) => ({
      otpSent: true,
      otpDelivery: createWhatsAppDeliveryResult('READY', {
        sent: true,
        normalizedPhone: phoneNumber,
      }),
    }),
    ...overrides,
  };

  return deps;
}

test('username-only profile updates succeed without password', async () => {
  const deps = createDeps();
  const result = await updateOwnProfile({
    userId: 1,
    username: 'new_user',
    email: 'test@test.com',
    phoneNumber: '905551234567',
  }, deps);

  assert.equal(result.profile.username, 'new_user');
  assert.equal(result.otpSent, false);
  assert.equal(result.otpDelivery, null);
});

test('email change requires current password', async () => {
  const deps = createDeps();

  await assert.rejects(
    () => updateOwnProfile({
      userId: 1,
      username: 'testuser',
      email: 'new@test.com',
      phoneNumber: '905551234567',
    }, deps),
    /mevcut sifrenizi girin/i,
  );
});

test('email change rejects invalid current password', async () => {
  const deps = createDeps();

  await assert.rejects(
    () => updateOwnProfile({
      userId: 1,
      username: 'testuser',
      email: 'new@test.com',
      phoneNumber: '905551234567',
      currentPassword: 'wrong-password',
    }, deps),
    /mevcut sifre hatali/i,
  );
});

test('phone change normalizes number and dispatches OTP after password confirmation', async () => {
  let dispatchedPhone: string | null = null;
  const deps = createDeps({
    dispatchOtp: async (phoneNumber) => {
      dispatchedPhone = phoneNumber;
      return {
        otpSent: true,
        otpDelivery: createWhatsAppDeliveryResult('READY', {
          sent: true,
          normalizedPhone: phoneNumber,
        }),
      };
    },
  });

  const result = await updateOwnProfile({
    userId: 1,
    username: 'testuser',
    email: 'test@test.com',
    phoneNumber: '05556667788',
    currentPassword: 'correct-password',
  }, deps);

  assert.equal(dispatchedPhone, '905556667788');
  assert.equal(result.profile.phoneNumber, '905556667788');
  assert.equal(result.profile.phoneVerified, false);
  assert.equal(result.otpSent, true);
});

test('phone change keeps profile update but reports otp failure when dispatch fails', async () => {
  const deps = createDeps({
    dispatchOtp: async (phoneNumber) => ({
      otpSent: false,
      otpDelivery: createWhatsAppDeliveryResult('DISCONNECTED', {
        sent: false,
        reason: 'WHATSAPP_NOT_READY',
        error: 'Bot hazir degil.',
        normalizedPhone: phoneNumber,
        retryable: true,
      }),
    }),
  });

  const result = await updateOwnProfile({
    userId: 1,
    username: 'testuser',
    email: 'test@test.com',
    phoneNumber: '05556667788',
    currentPassword: 'correct-password',
  }, deps);

  assert.equal(result.profile.phoneNumber, '905556667788');
  assert.equal(result.otpSent, false);
  assert.equal(result.otpDelivery?.error, 'Bot hazir degil.');
});
