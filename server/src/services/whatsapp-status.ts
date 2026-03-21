export type WhatsAppStatus = 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED';

export const WHATSAPP_UNAVAILABLE_ERROR_CODE = 'WHATSAPP_UNAVAILABLE';
export const WHATSAPP_NUMBER_NOT_FOUND_ERROR_CODE = 'WHATSAPP_NUMBER_NOT_FOUND';
export const INVALID_PHONE_NUMBER_ERROR_CODE = 'INVALID_PHONE_NUMBER';
export const WHATSAPP_DELIVERY_FAILED_ERROR_CODE = 'WHATSAPP_DELIVERY_FAILED';

export type WhatsAppOtpFailureReason =
  | 'WHATSAPP_NOT_READY'
  | 'INVALID_PHONE_NUMBER'
  | 'WHATSAPP_ACCOUNT_NOT_FOUND'
  | 'SEND_FAILED';

export interface WhatsAppStatusSnapshot {
  status: WhatsAppStatus;
  qrCode: string | null;
  isReadyForOtp: boolean;
  summary: string;
  lastError: string | null;
  lastTransitionAt: string | null;
  botPhoneNumber: string | null;
}

export interface WhatsAppUnavailablePayload {
  error: string;
  code: typeof WHATSAPP_UNAVAILABLE_ERROR_CODE;
  whatsappStatus: WhatsAppStatus;
  retryable: true;
  reason: 'WHATSAPP_NOT_READY' | 'SEND_FAILED';
  normalizedPhone: string | null;
  lastError: string | null;
}

export interface WhatsAppDeliveryErrorPayload {
  error: string;
  code:
    | typeof WHATSAPP_UNAVAILABLE_ERROR_CODE
    | typeof WHATSAPP_NUMBER_NOT_FOUND_ERROR_CODE
    | typeof INVALID_PHONE_NUMBER_ERROR_CODE
    | typeof WHATSAPP_DELIVERY_FAILED_ERROR_CODE;
  whatsappStatus: WhatsAppStatus;
  retryable: boolean;
  reason: WhatsAppOtpFailureReason;
  normalizedPhone: string | null;
  lastError: string | null;
}

export interface WhatsAppOtpDeliveryResult {
  sent: boolean;
  reason: WhatsAppOtpFailureReason | null;
  error: string | null;
  whatsappStatus: WhatsAppStatus;
  normalizedPhone: string | null;
  retryable: boolean;
}

export function isWhatsAppReadyForOtp(status: WhatsAppStatus): boolean {
  return status === 'READY';
}

export function getWhatsAppStatusSummary(status: WhatsAppStatus): string {
  switch (status) {
    case 'READY':
      return 'Bot hazir. OTP mesajlari gonderilebilir.';
    case 'QR_READY':
      return 'WhatsApp QR kodu bekliyor. Admin panelinden kod okutulmadan sifre sifirlama calismaz.';
    case 'AUTHENTICATED':
      return 'WhatsApp girisi tamamlandi. Sohbetler yuklenirken OTP gonderimi henuz hazir degil.';
    case 'INITIALIZING':
      return 'WhatsApp istemcisi baslatiliyor. OTP gonderimi icin kisa bir sure daha bekleyin.';
    case 'DISCONNECTED':
      return 'WhatsApp baglantisi kesildi. Sistem yeniden baglanmayi deniyor.';
    default:
      return 'WhatsApp durumu bilinmiyor.';
  }
}

export function createWhatsAppStatusSnapshot(
  status: WhatsAppStatus,
  qrCode: string | null,
  metadata: {
    lastError: string | null;
    lastTransitionAt: string | null;
    botPhoneNumber: string | null;
  },
): WhatsAppStatusSnapshot {
  return {
    status,
    qrCode,
    isReadyForOtp: isWhatsAppReadyForOtp(status),
    summary: getWhatsAppStatusSummary(status),
    lastError: metadata.lastError,
    lastTransitionAt: metadata.lastTransitionAt,
    botPhoneNumber: metadata.botPhoneNumber,
  };
}

export function createWhatsAppUnavailablePayload(status: WhatsAppStatus, lastError: string | null = null): WhatsAppUnavailablePayload {
  let error = 'WhatsApp dogrulama servisi su anda hazir degil. Lutfen daha sonra tekrar deneyin.';

  if (status === 'QR_READY' || status === 'INITIALIZING') {
    error = 'WhatsApp dogrulama servisi hazirlaniyor. Lutfen birkac dakika sonra tekrar deneyin.';
  } else if (status === 'DISCONNECTED') {
    error = 'WhatsApp dogrulama servisi gecici olarak kapali. Lutfen daha sonra tekrar deneyin.';
  }

  return {
    error,
    code: WHATSAPP_UNAVAILABLE_ERROR_CODE,
    whatsappStatus: status,
    retryable: true,
    reason: 'WHATSAPP_NOT_READY',
    normalizedPhone: null,
    lastError,
  };
}

export function createWhatsAppDeliveryResult(
  status: WhatsAppStatus,
  options: {
    sent: boolean;
    reason?: WhatsAppOtpFailureReason | null;
    error?: string | null;
    normalizedPhone?: string | null;
    retryable?: boolean;
  },
): WhatsAppOtpDeliveryResult {
  return {
    sent: options.sent,
    reason: options.reason ?? null,
    error: options.error ?? null,
    whatsappStatus: status,
    normalizedPhone: options.normalizedPhone ?? null,
    retryable: options.retryable ?? false,
  };
}

export function createWhatsAppDeliveryErrorPayload(result: WhatsAppOtpDeliveryResult): WhatsAppDeliveryErrorPayload {
  if (result.sent || !result.reason) {
    throw new Error('Basarili bir gonderim sonucu hata payloadina donusturulemez.');
  }

  if (result.reason === 'WHATSAPP_NOT_READY') {
    const unavailable = createWhatsAppUnavailablePayload(result.whatsappStatus, result.error);
    return {
      ...unavailable,
      normalizedPhone: result.normalizedPhone,
      reason: result.reason,
    };
  }

  if (result.reason === 'INVALID_PHONE_NUMBER') {
    return {
      error: result.error ?? 'Telefon numarasi gecersiz.',
      code: INVALID_PHONE_NUMBER_ERROR_CODE,
      whatsappStatus: result.whatsappStatus,
      retryable: false,
      reason: result.reason,
      normalizedPhone: result.normalizedPhone,
      lastError: result.error,
    };
  }

  if (result.reason === 'WHATSAPP_ACCOUNT_NOT_FOUND') {
    return {
      error: result.error ?? 'Bu telefon numarasi icin aktif bir WhatsApp hesabi bulunamadi.',
      code: WHATSAPP_NUMBER_NOT_FOUND_ERROR_CODE,
      whatsappStatus: result.whatsappStatus,
      retryable: false,
      reason: result.reason,
      normalizedPhone: result.normalizedPhone,
      lastError: result.error,
    };
  }

  return {
    error: result.error ?? 'WhatsApp mesaji gonderilemedi. Lutfen daha sonra tekrar deneyin.',
    code: WHATSAPP_DELIVERY_FAILED_ERROR_CODE,
    whatsappStatus: result.whatsappStatus,
    retryable: true,
    reason: result.reason,
    normalizedPhone: result.normalizedPhone,
    lastError: result.error,
  };
}
