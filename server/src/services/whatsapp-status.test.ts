import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWhatsAppDeliveryErrorPayload,
  createWhatsAppDeliveryResult,
  createWhatsAppStatusSnapshot,
  createWhatsAppUnavailablePayload,
} from './whatsapp-status';

test('createWhatsAppStatusSnapshot exposes readiness and summary for READY state', () => {
  const snapshot = createWhatsAppStatusSnapshot('READY', null, {
    lastError: null,
    lastTransitionAt: '2026-03-20T12:00:00.000Z',
    botPhoneNumber: '905551234567',
  });

  assert.equal(snapshot.isReadyForOtp, true);
  assert.equal(snapshot.summary, 'Bot hazir. OTP mesajlari gonderilebilir.');
  assert.equal(snapshot.botPhoneNumber, '905551234567');
});

test('createWhatsAppStatusSnapshot marks QR_READY as unavailable', () => {
  const snapshot = createWhatsAppStatusSnapshot('QR_READY', 'data:image/png;base64,abc', {
    lastError: null,
    lastTransitionAt: null,
    botPhoneNumber: null,
  });

  assert.equal(snapshot.isReadyForOtp, false);
  assert.match(snapshot.summary, /QR kodu bekliyor/i);
  assert.equal(snapshot.qrCode, 'data:image/png;base64,abc');
});

test('createWhatsAppUnavailablePayload maps QR_READY to a retryable response', () => {
  const payload = createWhatsAppUnavailablePayload('QR_READY');

  assert.equal(payload.code, 'WHATSAPP_UNAVAILABLE');
  assert.equal(payload.retryable, true);
  assert.equal(payload.whatsappStatus, 'QR_READY');
  assert.equal(payload.reason, 'WHATSAPP_NOT_READY');
  assert.match(payload.error, /hazirlaniyor/i);
});

test('createWhatsAppUnavailablePayload maps DISCONNECTED to a temporary outage message', () => {
  const payload = createWhatsAppUnavailablePayload('DISCONNECTED');

  assert.equal(payload.whatsappStatus, 'DISCONNECTED');
  assert.match(payload.error, /gecici olarak kapali/i);
});

test('createWhatsAppDeliveryErrorPayload maps number-not-found into a non-retryable response', () => {
  const payload = createWhatsAppDeliveryErrorPayload(createWhatsAppDeliveryResult('READY', {
    sent: false,
    reason: 'WHATSAPP_ACCOUNT_NOT_FOUND',
    error: 'Bu telefon numarasi icin aktif bir WhatsApp hesabi bulunamadi.',
    normalizedPhone: '905551234567',
    retryable: false,
  }));

  assert.equal(payload.code, 'WHATSAPP_NUMBER_NOT_FOUND');
  assert.equal(payload.retryable, false);
  assert.equal(payload.normalizedPhone, '905551234567');
});

test('createWhatsAppDeliveryErrorPayload maps send failures into retryable errors', () => {
  const payload = createWhatsAppDeliveryErrorPayload(createWhatsAppDeliveryResult('READY', {
    sent: false,
    reason: 'SEND_FAILED',
    error: 'Connection closed.',
    normalizedPhone: '905551234567',
    retryable: true,
  }));

  assert.equal(payload.code, 'WHATSAPP_DELIVERY_FAILED');
  assert.equal(payload.retryable, true);
  assert.equal(payload.lastError, 'Connection closed.');
});
