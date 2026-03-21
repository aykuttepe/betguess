import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import {
  WhatsAppOtpDeliveryResult,
  WhatsAppStatus,
  WhatsAppStatusSnapshot,
  createWhatsAppDeliveryResult,
  createWhatsAppStatusSnapshot,
  isWhatsAppReadyForOtp,
} from './whatsapp-status';
import { normalizePhoneNumber } from './phone-number';

class WhatsAppOTPService {
  private client: Client;
  private status: WhatsAppStatus = 'INITIALIZING';
  private qrCodeDataUrl: string | null = null;
  private botPhoneNumber: string | null = null;
  private lastError: string | null = null;
  private lastTransitionAt: string | null = null;
  private initializationInFlight: Promise<void> | null = null;
  private reconnectScheduled = false;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './whatsapp_auth' }),
      takeoverOnConflict: true,
      takeoverTimeoutMs: 0,
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
        ],
      },
    });

    this.markStatus('INITIALIZING');

    this.client.on('qr', async (qr) => {
      this.markStatus('QR_READY');
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 4, scale: 8 });
        this.log('QR kod olusturuldu, lutfen Admin panelinden okutun.');
      } catch (err) {
        this.recordError('QR kod uretilirken hata.', err);
      }
    });

    this.client.on('authenticated', () => {
      this.markStatus('AUTHENTICATED');
      this.qrCodeDataUrl = null;
      this.log('Kimlik dogrulama basarili.');
    });

    this.client.on('auth_failure', (message) => {
      this.markStatus('DISCONNECTED', message || 'Kimlik dogrulama basarisiz.');
      this.qrCodeDataUrl = null;
      this.log(`Kimlik dogrulama basarisiz: ${message}`);
    });

    this.client.on('ready', () => {
      this.markStatus('READY');
      try {
        const info = (this.client as any).info;
        if (info?.wid?.user) {
          this.botPhoneNumber = info.wid.user;
          this.log(`Bot telefon numarasi: ${this.botPhoneNumber}`);
        }
      } catch { /* ignore */ }
      this.log('WhatsApp bot hazir ve mesaj gonderebilir durumda.');
    });

    this.client.on('change_state', (state) => {
      this.log(`Durum degisti: ${state}`);
    });

    this.client.on('loading_screen', (percent, message) => {
      this.log(`Yukleniyor: %${percent} - ${message}`);
    });

    this.client.on('disconnected', (reason) => {
      this.markStatus('DISCONNECTED', typeof reason === 'string' ? reason : 'Baglanti koptu.');
      this.qrCodeDataUrl = null;
      this.log(`Baglanti koptu: ${reason}`);
      this.scheduleReconnect();
    });
  }

  public async initialize() {
    if (this.initializationInFlight) {
      return this.initializationInFlight;
    }

    this.markStatus('INITIALIZING');
    this.log('Servis baslatiliyor...');
    this.initializationInFlight = this.client.initialize()
      .catch((err) => {
        this.markStatus('DISCONNECTED', this.stringifyError(err));
        this.recordError('Baslatma hatasi.', err);
      })
      .finally(() => {
        this.initializationInFlight = null;
      });

    return this.initializationInFlight;
  }

  public getStatus(): WhatsAppStatusSnapshot {
    return createWhatsAppStatusSnapshot(this.status, this.qrCodeDataUrl, {
      lastError: this.lastError,
      lastTransitionAt: this.lastTransitionAt,
      botPhoneNumber: this.botPhoneNumber,
    });
  }

  public getBotPhoneNumber(): string | null {
    return this.botPhoneNumber;
  }

  public canSendOtp(): boolean {
    return isWhatsAppReadyForOtp(this.status);
  }

  public async sendOTP(phoneNumber: string, code: string): Promise<WhatsAppOtpDeliveryResult> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone.isValid || !normalizedPhone.normalizedPhone) {
      return createWhatsAppDeliveryResult(this.status, {
        sent: false,
        reason: 'INVALID_PHONE_NUMBER',
        error: normalizedPhone.reason,
        retryable: false,
      });
    }

    if (!this.canSendOtp()) {
      const error = `Bot hazir degil, mesaj gonderilemez. Durum: ${this.status}`;
      this.log(error);
      return createWhatsAppDeliveryResult(this.status, {
        sent: false,
        reason: 'WHATSAPP_NOT_READY',
        error,
        normalizedPhone: normalizedPhone.normalizedPhone,
        retryable: true,
      });
    }

    try {
      const numberId = await this.client.getNumberId(normalizedPhone.normalizedPhone);
      if (!numberId?._serialized) {
        const error = 'Bu telefon numarasi icin aktif bir WhatsApp hesabi bulunamadi.';
        this.log(`OTP gonderim iptal edildi: ${normalizedPhone.normalizedPhone} WhatsApp'ta kayitli degil.`);
        return createWhatsAppDeliveryResult(this.status, {
          sent: false,
          reason: 'WHATSAPP_ACCOUNT_NOT_FOUND',
          error,
          normalizedPhone: normalizedPhone.normalizedPhone,
          retryable: false,
        });
      }

      const message = `[BetGuess]\n\nDogrulama kodunuz: *${code}*\n\nLutfen kodunuzu kimseyle paylasmayin.`;

      await this.client.sendMessage(numberId._serialized, message);
      this.log(`OTP gonderildi: ${normalizedPhone.normalizedPhone}`);
      return createWhatsAppDeliveryResult(this.status, {
        sent: true,
        normalizedPhone: normalizedPhone.normalizedPhone,
      });
    } catch (err) {
      const error = this.stringifyError(err);
      this.recordError('OTP gonderim hatasi.', err);
      return createWhatsAppDeliveryResult(this.status, {
        sent: false,
        reason: 'SEND_FAILED',
        error,
        normalizedPhone: normalizedPhone.normalizedPhone,
        retryable: true,
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectScheduled) {
      return;
    }

    this.reconnectScheduled = true;
    setTimeout(() => {
      this.reconnectScheduled = false;
      this.log('Yeniden baslatiliyor...');
      void this.initialize();
    }, 5000);
  }

  private markStatus(status: WhatsAppStatus, error: string | null = null) {
    this.status = status;
    this.lastTransitionAt = new Date().toISOString();
    this.lastError = error;
  }

  private log(message: string) {
    console.log(`[WhatsApp] ${message}`);
  }

  private recordError(context: string, err: unknown) {
    const error = this.stringifyError(err);
    this.lastError = error;
    console.error(`[WhatsApp] ${context}`, err);
  }

  private stringifyError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }

    return typeof err === 'string' ? err : 'Bilinmeyen hata';
  }
}

export const whatsappService = new WhatsAppOTPService();
