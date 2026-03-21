import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { requireAdmin } from '../auth/auth-middleware';
import { AuthRequest } from '../auth/types';
import { listUsers, findById, updateRole, updateTitle, updateSubscription, setActive, getStats, getUserDetail } from '../db/user-repository';
import { getDatabase } from '../db/database';
import { whatsappService } from '../services/whatsapp-service';

const router = Router();

// All admin routes require admin role
router.use(requireAdmin as any);

router.get('/whatsapp/status', (_req: AuthRequest, res: Response) => {
  res.json(whatsappService.getStatus());
});

router.get('/stats', (_req: AuthRequest, res: Response) => {
  res.json(getStats());
});

router.get('/users/:id', (req: AuthRequest, res: Response) => {
  const userId = parseInt(String(req.params.id), 10);
  const detail = getUserDetail(userId);
  if (!detail) {
    res.status(404).json({ error: 'Kullanici bulunamadi.' });
    return;
  }
  res.json(detail);
});

router.get('/users', (_req: AuthRequest, res: Response) => {
  const users = listUsers().map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    title: u.title,
    subscriptionTier: u.subscription_tier,
    subscriptionExpiresAt: u.subscription_expires_at,
    isActive: u.is_active === 1,
    createdAt: u.created_at,
  }));
  res.json({ users });
});

router.patch('/users/:id/role', (req: AuthRequest, res: Response) => {
  const userId = parseInt(String(req.params.id), 10);
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    res.status(400).json({ error: 'Gecersiz rol. "user" veya "admin" olmalidir.' });
    return;
  }

  if (userId === req.user?.id && role !== 'admin') {
    res.status(400).json({ error: 'Kendi admin rolunuzu kaldiramazsiniz.' });
    return;
  }

  const user = findById(userId);
  if (!user) {
    res.status(404).json({ error: 'Kullanici bulunamadi.' });
    return;
  }

  updateRole(userId, role);
  res.json({ message: 'Rol guncellendi.', role });
});

router.patch('/users/:id/title', (req: AuthRequest, res: Response) => {
  const userId = parseInt(String(req.params.id), 10);
  const { title } = req.body;

  const user = findById(userId);
  if (!user) {
    res.status(404).json({ error: 'Kullanici bulunamadi.' });
    return;
  }

  const newTitle = title?.trim() || null;
  updateTitle(userId, newTitle);
  res.json({ message: 'Unvan guncellendi.', title: newTitle });
});

router.patch('/users/:id/subscription', (req: AuthRequest, res: Response) => {
  const userId = parseInt(String(req.params.id), 10);
  const { tier, expiresAt } = req.body;

  if (!['free', 'pro', 'premium'].includes(tier)) {
    res.status(400).json({ error: 'Gecersiz abonelik tipi. "free", "pro" veya "premium" olmalidir.' });
    return;
  }

  const user = findById(userId);
  if (!user) {
    res.status(404).json({ error: 'Kullanici bulunamadi.' });
    return;
  }

  updateSubscription(userId, tier, expiresAt || null);
  res.json({ message: 'Abonelik guncellendi.', tier, expiresAt: expiresAt || null });
});

router.patch('/users/:id/active', (req: AuthRequest, res: Response) => {
  const userId = parseInt(String(req.params.id), 10);
  const { isActive } = req.body;

  if (userId === req.user?.id) {
    res.status(400).json({ error: 'Kendi hesabinizi devre disi birakamazsiniz.' });
    return;
  }

  const user = findById(userId);
  if (!user) {
    res.status(404).json({ error: 'Kullanici bulunamadi.' });
    return;
  }

  setActive(userId, !!isActive);
  res.json({ message: isActive ? 'Hesap aktif edildi.' : 'Hesap devre disi birakildi.', isActive: !!isActive });
});

router.post('/users/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Yeni sifre en az 6 karakter olmalidir.' });
      return;
    }

    const user = findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Kullanici bulunamadi.' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const db = getDatabase();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, userId);

    res.json({ message: `${user.username} kullanicisinin sifresi basariyla sifirlandi.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
