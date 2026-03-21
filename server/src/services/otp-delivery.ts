import { saveOtp } from '../db/user-repository';
import {
  WhatsAppDeliveryErrorPayload,
  WhatsAppOtpDeliveryResult,
  createWhatsAppDeliveryErrorPayload,
} from './whatsapp-status';

export interface OtpDeliveryService {
  sendOTP(phoneNumber: string, code: string): Promise<WhatsAppOtpDeliveryResult>;
}

export interface DispatchOtpOptions {
  generateCode?: () => string;
  saveOtpFn?: typeof saveOtp;
  lifetimeMinutes?: number;
  targetKey?: string;
  purpose?: string;
}

export interface DispatchOtpResult {
  otpSent: boolean;
  otpDelivery: WhatsAppOtpDeliveryResult;
}

export function createOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function dispatchWhatsAppOtp(
  phoneNumber: string,
  otpService: OtpDeliveryService,
  options: DispatchOtpOptions = {},
): Promise<DispatchOtpResult> {
  const generateCode = options.generateCode ?? createOtpCode;
  const persistOtp = options.saveOtpFn ?? saveOtp;
  const lifetimeMinutes = options.lifetimeMinutes ?? 5;
  const targetKey = options.targetKey ?? phoneNumber;
  const purpose = options.purpose ?? 'phone_verification';
  const code = generateCode();
  const otpDelivery = await otpService.sendOTP(phoneNumber, code);

  if (otpDelivery.sent && otpDelivery.normalizedPhone) {
    persistOtp(targetKey, code, lifetimeMinutes, purpose, otpDelivery.normalizedPhone);
  }

  return {
    otpSent: otpDelivery.sent,
    otpDelivery,
  };
}

export function getOtpDeliveryFailureStatus(result: WhatsAppOtpDeliveryResult): number {
  return result.retryable ? 503 : 400;
}

export function getOtpDeliveryFailurePayload(result: WhatsAppOtpDeliveryResult): WhatsAppDeliveryErrorPayload {
  return createWhatsAppDeliveryErrorPayload(result);
}
