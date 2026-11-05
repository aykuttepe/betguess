import { Router } from 'express';
import { AuthRequest } from '../auth/types';
import { findByUsernameOrEmail } from '../db/user-repository';
import {
  listFriendRequests,
  listFriends,
  removeFriend,
  respondToFriendRequest,
  searchUsersForFriends,
  sendFriendRequest,
} from '../db/friend-repository';
import { createNotification } from '../db/notification-repository';

const router = Router();

router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    res.json(listFriends(userId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const query = String(req.query.q || '').trim();
    res.json(searchUsersForFriends(userId, query));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    res.json(listFriendRequests(userId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/requests', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const recipientInput = String(req.body.recipient || '').trim();
    if (!recipientInput) {
      return res.status(400).json({ error: 'Kullanici adi veya e-posta gerekli.' });
    }

    const recipient = findByUsernameOrEmail(recipientInput);
    if (!recipient || recipient.is_active !== 1) {
      return res.status(404).json({ error: 'Kullanici bulunamadi.' });
    }

    const requestId = sendFriendRequest(userId, recipient.id);
    createNotification(recipient.id, 'friend_request', userId, null, null, null, {
      friendRequestId: requestId,
    });
    res.json({ success: true, recipient: { id: recipient.id, username: recipient.username } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/requests/:id/respond', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const requestId = parseInt(req.params.id as string, 10);
    if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid ID' });

    const action = req.body.action === 'accept' ? 'accept' : req.body.action === 'decline' ? 'decline' : null;
    if (!action) return res.status(400).json({ error: 'Gecersiz islem.' });

    const request = respondToFriendRequest(requestId, userId, action);
    createNotification(
      request.requester_id,
      action === 'accept' ? 'friend_accepted' : 'friend_declined',
      userId,
      null,
      null,
      null,
      { friendRequestId: requestId },
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const friendId = parseInt(req.params.id as string, 10);
    if (isNaN(friendId)) return res.status(400).json({ error: 'Invalid ID' });

    removeFriend(userId, friendId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
