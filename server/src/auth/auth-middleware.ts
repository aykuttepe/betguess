import { Response, NextFunction } from 'express';
import { AuthRequest, SubscriptionTier } from './types';
import { verifyAccessToken, verifyRefreshToken, getUserById, generateTokens } from './auth-service';
import { setAuthCookies } from './cookie-utils';

const TIER_LEVELS: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const accessToken = req.cookies?.access_token;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      const user = getUserById(payload.userId);
      if (user && user.isActive) {
        req.user = user;
        next();
        return;
      }
    } catch {
      // Access token expired, try refresh
    }
  }

  // Try refresh token
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = getUserById(payload.userId);
      if (user && user.isActive) {
        const tokens = generateTokens(user);
        setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
        req.user = user;
        next();
        return;
      }
    } catch {
      // Refresh token also invalid
    }
  }

  res.status(401).json({ error: 'Oturum suresi doldu. Lutfen tekrar giris yapin.' });
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const accessToken = req.cookies?.access_token;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      const user = getUserById(payload.userId);
      if (user && user.isActive) {
        req.user = user;
      }
    } catch {
      // Token invalid — that's fine, continue as anonymous
    }
  }

  if (!req.user) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        const user = getUserById(payload.userId);
        if (user && user.isActive) {
          req.user = user;
        }
      } catch {
        // Refresh also invalid
      }
    }
  }

  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Bu islemi yapmaya yetkiniz yok.' });
      return;
    }
    next();
  });
}

export function requireSubscription(minTier: SubscriptionTier) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const user = req.user!;

      // Admin bypass — admins have unrestricted access
      if (user.role === 'admin') {
        next();
        return;
      }

      const userLevel = TIER_LEVELS[user.subscriptionTier];
      const requiredLevel = TIER_LEVELS[minTier];

      if (userLevel < requiredLevel) {
        res.status(403).json({
          error: `Bu ozellik ${minTier} abonelik gerektirir. Mevcut aboneliginiz: ${user.subscriptionTier}`,
          requiredTier: minTier,
          currentTier: user.subscriptionTier,
        });
        return;
      }

      // Check expiration
      if (user.subscriptionTier !== 'free' && user.subscriptionExpiresAt) {
        const expiresAt = new Date(user.subscriptionExpiresAt + 'Z');
        if (expiresAt < new Date()) {
          res.status(403).json({
            error: 'Aboneliginiz sona ermis. Lutfen yenileyin.',
            requiredTier: minTier,
            expired: true,
          });
          return;
        }
      }

      next();
    });
  };
}
