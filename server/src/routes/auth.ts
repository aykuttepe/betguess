import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { register, login, toPublicUser } from '../auth/auth-service';
import { setAuthCookies, clearAuthCookies } from '../auth/cookie-utils';
import { requireAuth } from '../auth/auth-middleware';
import { AuthRequest, SubscriptionTier } from '../auth/types';
import { getLatestUsers, findByEmail, verifyOtp, markPhoneVerified, findById, getUserDetail } from '../db/user-repository';
import { whatsappService } from '../services/whatsapp-service';
import { getDatabase } from '../db/database';
import { arePhoneNumbersEquivalent, normalizePhoneNumber } from '../services/phone-number';
import { dispatchWhatsAppOtp, getOtpDeliveryFailurePayload, getOtpDeliveryFailureStatus } from '../services/otp-delivery';
import { updateOwnProfile } from '../services/profile-update-service';
import { getUserUsageSummary, getSavedCouponCount } from '../db/usage-repository';

const router = Router();

router.get('/latest-users', (_req, res) => {
  try {
    const users = getLatestUsers(5);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, username, password, phoneNumber } = req.body;

    if (!email || !username || !password) {
      res.status(400).json({ error: 'Tum alanlar zorunludur.' });
      return;
    }

    const result = await register(email, username, password, phoneNumber);
    setAuthCookies(res, result.accessToken, result.refreshToken);

    let otpDelivery = null;
    if (result.user.phoneNumber) {
      const dispatchResult = await dispatchWhatsAppOtp(result.user.phoneNumber, whatsappService);
      otpDelivery = dispatchResult.otpDelivery;
    }

    res.status(201).json({ user: toPublicUser(result.user), otpDelivery });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'E-posta ve sifre gereklidir.' });
      return;
    }

    const result = await login(email, password);
    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.json({ user: toPublicUser(result.user) });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: 'Basariyla cikis yapildi.' });
});

// Get WhatsApp bot info for phone verification flow (user-facing, no admin details)
router.get('/whatsapp-info', requireAuth as any, (_req: AuthRequest, res: Response) => {
  const waStatus = whatsappService.getStatus();
  const botPhone = whatsappService.getBotPhoneNumber();
  res.json({
    isReady: waStatus.isReadyForOtp,
    botPhoneNumber: botPhone,
  });
});

// Update phone number (or set for first time)
router.post('/update-phone', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      res.status(400).json({ error: 'Gecerli bir telefon numarasi girin.' });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone.isValid || !normalizedPhone.normalizedPhone) {
      res.status(400).json({ error: normalizedPhone.reason ?? 'Gecerli bir telefon numarasi girin.' });
      return;
    }

    const trimmed = normalizedPhone.normalizedPhone;
    const userId = req.user!.id;
    const currentUser = findById(userId);
    if (!currentUser) {
      res.status(404).json({ error: 'Kullanici bulunamadi.' });
      return;
    }

    const db = getDatabase();
    db.prepare('UPDATE users SET phone_number = ?, phone_verified = 0, updated_at = datetime(\'now\') WHERE id = ?')
      .run(trimmed, userId);

    const dispatchResult = await dispatchWhatsAppOtp(trimmed, whatsappService, {
      targetKey: `phone_verification:${userId}`,
      purpose: 'phone_verification',
    });
    if (dispatchResult.otpSent) {
      res.json({ message: 'Telefon numarasi kaydedildi. Dogrulama kodu WhatsApp ile gonderildi.', otpSent: true });
    } else {
      res.json({
        message: `Telefon numarasi kaydedildi fakat dogrulama kodu gonderilemedi. ${dispatchResult.otpDelivery.error ?? 'Lutfen daha sonra tekrar deneyin.'}`,
        otpSent: false,
        otpDelivery: dispatchResult.otpDelivery,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send (or re-send) verification OTP
router.post('/send-verification-otp', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const userRow = findById(req.user!.id);
    if (!userRow || !userRow.phone_number) {
      res.status(400).json({ error: 'Once bir telefon numarasi kaydedin.' });
      return;
    }

    if (userRow.phone_verified === 1) {
      res.status(400).json({ error: 'Telefon numaraniz zaten dogrulanmis.' });
      return;
    }

    const dispatchResult = await dispatchWhatsAppOtp(userRow.phone_number, whatsappService, {
      targetKey: `phone_verification:${req.user!.id}`,
      purpose: 'phone_verification',
    });
    if (!dispatchResult.otpSent) {
      res.status(getOtpDeliveryFailureStatus(dispatchResult.otpDelivery)).json(getOtpDeliveryFailurePayload(dispatchResult.otpDelivery));
      return;
    }

    res.json({ message: 'Dogrulama kodu WhatsApp ile gonderildi.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify phone with OTP code
router.post('/verify-phone', requireAuth as any, (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    const userRow = findById(req.user!.id);
    if (!userRow || !userRow.phone_number) {
      res.status(400).json({ error: 'Telefon numarasi bulunamadi.' });
      return;
    }

    if (!verifyOtp(`phone_verification:${req.user!.id}`, code, 'phone_verification')) {
      res.status(400).json({ error: 'Gecersiz veya suresi dolmus kod.' });
      return;
    }

    markPhoneVerified(req.user!.id);
    res.json({ message: 'Telefon numaraniz basariyla dogrulandi.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;
    if (!email || !phoneNumber) {
      res.status(400).json({ error: 'E-posta ve telefon numarasi zorunludur.' });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone.isValid || !normalizedPhone.normalizedPhone) {
      res.status(400).json({ error: normalizedPhone.reason ?? 'Gecerli bir telefon numarasi girin.' });
      return;
    }

    const user = findByEmail(email);
    if (!user || !arePhoneNumbersEquivalent(user.phone_number, normalizedPhone.normalizedPhone)) {
      res.status(404).json({ error: 'Bu e-posta ve telefon numarasina ait bir hesap bulunamadi.' });
      return;
    }

    const resetTargetKey = `password_reset:${email.toLowerCase().trim()}:${normalizedPhone.normalizedPhone}`;
    const dispatchResult = await dispatchWhatsAppOtp(normalizedPhone.normalizedPhone, whatsappService, {
      targetKey: resetTargetKey,
      purpose: 'password_reset',
    });
    if (!dispatchResult.otpSent) {
      res.status(getOtpDeliveryFailureStatus(dispatchResult.otpDelivery)).json(getOtpDeliveryFailurePayload(dispatchResult.otpDelivery));
      return;
    }

    res.json({ message: 'Dogrulama kodu WhatsApp uzerinden gonderildi.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, phoneNumber, code, newPassword } = req.body;

    if (!email || !phoneNumber || !code || !newPassword) {
      res.status(400).json({ error: 'E-posta, telefon numarasi, kod ve yeni sifre girilmelidir.' });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone.isValid || !normalizedPhone.normalizedPhone) {
      res.status(400).json({ error: normalizedPhone.reason ?? 'Gecerli bir telefon numarasi girin.' });
      return;
    }

    const resetTargetKey = `password_reset:${email.toLowerCase().trim()}:${normalizedPhone.normalizedPhone}`;
    if (!verifyOtp(resetTargetKey, code, 'password_reset')) {
      res.status(400).json({ error: 'Dogrulama kodu hatali veya suresi dolmus.' });
      return;
    }

    const user = findByEmail(email);
    if (!user || !arePhoneNumbersEquivalent(user.phone_number, normalizedPhone.normalizedPhone)) {
      res.status(404).json({ error: 'Kullanici bulunamadi.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const db = getDatabase();
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

    res.json({ message: 'Sifreniz basariyla guncellendi. Yeni sifrenizle giris yapabilirsiniz.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth as any, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Oturum bulunamadi.' });
    return;
  }
  res.json({ user: toPublicUser(req.user) });
});

// ─── Profile endpoints ───────────────────────────────────────────────────────

router.get('/profile', requireAuth as any, (req: AuthRequest, res: Response) => {
  try {
    const detail = getUserDetail(req.user!.id);
    if (!detail) {
      res.status(404).json({ error: 'Kullanici bulunamadi.' });
      return;
    }
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/profile', requireAuth as any, (req: AuthRequest, res: Response) => {
  void (async () => {
    try {
      const result = await updateOwnProfile({
        userId: req.user!.id,
        username: req.body.username,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        title: req.body.title,
        currentPassword: req.body.currentPassword,
      });

      res.json(result);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Profil guncellenemedi.';
      const status = message === 'Kullanici bulunamadi.' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })();
});

router.post('/change-password', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Mevcut sifre ve yeni sifre zorunludur.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Yeni sifre en az 6 karakter olmalidir.' });
      return;
    }

    const userRow = findById(req.user!.id);
    if (!userRow) {
      res.status(404).json({ error: 'Kullanici bulunamadi.' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, userRow.password_hash);
    if (!valid) {
      res.status(400).json({ error: 'Mevcut sifre hatali.' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const db = getDatabase();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, req.user!.id);

    res.json({ message: 'Sifreniz basariyla guncellendi.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Subscription usage status ──────────────────────────────────────────────

const TIER_LIMITS_CONFIG: Record<string, Record<SubscriptionTier, number>> = {
  ai_match:      { free: 0,  pro: 15,  premium: -1 },
  ai_team:       { free: 0,  pro: 10,  premium: -1 },
  ai_league:     { free: 0,  pro: 10,  premium: -1 },
  ai_bulk:       { free: 0,  pro: 5,   premium: 20 },
  ai_player:     { free: 0,  pro: 10,  premium: -1 },
  ai_transfer:   { free: 0,  pro: 10,  premium: -1 },
  forum_topic:   { free: 2,  pro: 10,  premium: -1 },
  forum_comment: { free: 5,  pro: -1,  premium: -1 },
  kolon_generate: { free: 5, pro: -1,  premium: -1 },
};

const COUPON_LIMITS: Record<SubscriptionTier, number> = {
  free: 3,
  pro: 20,
  premium: -1,
};

const KOLON_LIMITS: Record<SubscriptionTier, number> = {
  free: -1,      // free: unlimited per generation, but 5 uses/day
  pro: 50000,
  premium: 500000,
};

const HISTORY_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  pro: 50,
  premium: 200,
};

router.get('/usage-status', requireAuth as any, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tier = user.subscriptionTier as SubscriptionTier;
    const usage = getUserUsageSummary(user.id);
    const savedCoupons = getSavedCouponCount(user.id);

    const limits: Record<string, { used: number; limit: number }> = {};

    // Daily usage limits
    for (const [action, tierLimits] of Object.entries(TIER_LIMITS_CONFIG)) {
      limits[action] = {
        used: usage[action] || 0,
        limit: tierLimits[tier],
      };
    }

    // Saved coupons (not daily, total)
    limits['saved_coupons'] = {
      used: savedCoupons,
      limit: COUPON_LIMITS[tier],
    };

    // Kolon limit
    limits['kolon'] = {
      used: 0, // tracked client-side per generation
      limit: KOLON_LIMITS[tier],
    };

    // History limit
    limits['history'] = {
      used: 0,
      limit: HISTORY_LIMITS[tier],
    };

    res.json({
      tier,
      limits,
      expiresAt: user.subscriptionExpiresAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public tier info (for pricing page) ─────────────────────────────────────

router.get('/tiers', (_req, res) => {
  res.json({
    tiers: [
      {
        id: 'free',
        name: 'Ucretsiz',
        price: 0,
        features: [
          { id: 'kolon', label: 'Kolon Uretimi', value: '5 kullanim/gun (sinirsiz kolon)' },
          { id: 'sistem', label: 'Sistem Kupon', value: 'Kilitli' },
          { id: 'coupons', label: 'Kupon Kaydetme', value: 'Max 3' },
          { id: 'live', label: 'Canli Takip', value: 'Tam erisim' },
          { id: 'sonuclar', label: 'Sonuclar', value: 'Tam erisim' },
          { id: 'history', label: 'Gecmis Analiz', value: 'Son 10 program' },
          { id: 'standings', label: 'Lig Siralamalari', value: 'Tam erisim' },
          { id: 'values', label: 'Takim Degerleri', value: 'Kilitli' },
          { id: 'player', label: 'Oyuncu Profil', value: 'Kilitli' },
          { id: 'match_intel', label: 'Mac Istihbarati', value: 'Kilitli' },
          { id: 'ai', label: 'AI Analiz', value: 'Kilitli' },
          { id: 'forum_topic', label: 'Forum Konu Acma', value: '2/gun' },
          { id: 'forum_comment', label: 'Forum Yorum', value: '5/gun' },
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: null,
        features: [
          { id: 'kolon', label: 'Kolon Uretimi', value: 'Max 50.000 kolon' },
          { id: 'sistem', label: 'Sistem Kupon', value: 'Tam erisim' },
          { id: 'coupons', label: 'Kupon Kaydetme', value: 'Max 20' },
          { id: 'live', label: 'Canli Takip', value: 'Tam erisim' },
          { id: 'sonuclar', label: 'Sonuclar', value: 'Tam erisim' },
          { id: 'history', label: 'Gecmis Analiz', value: 'Son 50 program' },
          { id: 'standings', label: 'Lig Siralamalari', value: 'Tam erisim' },
          { id: 'values', label: 'Takim Degerleri', value: 'Tam erisim' },
          { id: 'player', label: 'Oyuncu Profil', value: 'Tam erisim' },
          { id: 'match_intel', label: 'Mac Istihbarati', value: 'Tam erisim' },
          { id: 'ai', label: 'AI Analiz', value: '15/gun (mac), 10/gun (takim/lig/oyuncu/transfer), 5/gun (toplu)' },
          { id: 'forum_topic', label: 'Forum Konu Acma', value: '10/gun' },
          { id: 'forum_comment', label: 'Forum Yorum', value: 'Sinirsiz' },
        ],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: null,
        features: [
          { id: 'kolon', label: 'Kolon Uretimi', value: 'Max 500.000 kolon' },
          { id: 'sistem', label: 'Sistem Kupon', value: 'Tam erisim' },
          { id: 'coupons', label: 'Kupon Kaydetme', value: 'Sinirsiz' },
          { id: 'live', label: 'Canli Takip', value: 'Tam erisim' },
          { id: 'sonuclar', label: 'Sonuclar', value: 'Tam erisim' },
          { id: 'history', label: 'Gecmis Analiz', value: 'Son 200 program' },
          { id: 'standings', label: 'Lig Siralamalari', value: 'Tam erisim' },
          { id: 'values', label: 'Takim Degerleri', value: 'Tam erisim' },
          { id: 'player', label: 'Oyuncu Profil', value: 'Tam erisim' },
          { id: 'match_intel', label: 'Mac Istihbarati', value: 'Tam erisim' },
          { id: 'ai', label: 'AI Analiz', value: 'Sinirsiz + Toplu Analiz (20/gun)' },
          { id: 'forum_topic', label: 'Forum Konu Acma', value: 'Sinirsiz' },
          { id: 'forum_comment', label: 'Forum Yorum', value: 'Sinirsiz' },
        ],
      },
    ],
  });
});

export default router;
