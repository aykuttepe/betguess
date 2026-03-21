import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchWhatsAppOtp, getOtpDeliveryFailureStatus } from './otp-delivery';
import { createWhatsAppDeliveryResult } from './whatsapp-status';

test('dispatchWhatsAppOtp persists OTP only after successful delivery', async () => {
  const saves: Array<{ targetKey: string; code: string; lifetimeMinutes: number | undefined; purpose: string | undefined; phoneNumber: string | null | undefined }> = [];

  const result = await dispatchWhatsAppOtp('5551234567', {
    async sendOTP() {
      return createWhatsAppDeliveryResult('READY', {
        sent: true,
        normalizedPhone: '905551234567',
      });
    },
  }, {
    generateCode: () => '654321',
    targetKey: 'password_reset:test@test.com:905551234567',
    purpose: 'password_reset',
    saveOtpFn: (targetKey, code, lifetimeMinutes, purpose, phoneNumber) => {
      saves.push({ targetKey, code, lifetimeMinutes, purpose, phoneNumber });
    },
  });

  assert.equal(result.otpSent, true);
  assert.deepEqual(saves, [{
    targetKey: 'password_reset:test@test.com:905551234567',
    code: '654321',
    lifetimeMinutes: 5,
    purpose: 'password_reset',
    phoneNumber: '905551234567',
  }]);
});

test('dispatchWhatsAppOtp does not persist OTP when delivery fails', async () => {
  let saveCount = 0;

  const result = await dispatchWhatsAppOtp('5551234567', {
    async sendOTP() {
      return createWhatsAppDeliveryResult('DISCONNECTED', {
        sent: false,
        reason: 'WHATSAPP_NOT_READY',
        error: 'Bot hazir degil.',
        normalizedPhone: '905551234567',
        retryable: true,
      });
    },
  }, {
    saveOtpFn: () => {
      saveCount += 1;
    },
  });

  assert.equal(result.otpSent, false);
  assert.equal(saveCount, 0);
});

test('getOtpDeliveryFailureStatus returns 503 for retryable failures and 400 otherwise', () => {
  const retryable = getOtpDeliveryFailureStatus(createWhatsAppDeliveryResult('DISCONNECTED', {
    sent: false,
    reason: 'SEND_FAILED',
    error: 'Connection closed.',
    retryable: true,
  }));
  const nonRetryable = getOtpDeliveryFailureStatus(createWhatsAppDeliveryResult('READY', {
    sent: false,
    reason: 'WHATSAPP_ACCOUNT_NOT_FOUND',
    error: 'No account.',
    retryable: false,
  }));

  assert.equal(retryable, 503);
  assert.equal(nonRetryable, 400);
});
