import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ForumNotification } from '../lib/forum-types';
import {
  apiGetUnreadCount,
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
} from '../lib/forum-api';

const POLL_INTERVAL = 30_000;

function timeAgo(dateStr: string): string {
  // DB stores UTC without 'Z' suffix, so append it for correct parsing
  const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(utcStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'simdi';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} dakika once`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat once`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gun once`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay once`;
  return new Date(utcStr).toLocaleDateString('tr-TR');
}

const REACTION_EMOJI: Record<string, string> = {
  like: '👍',
  dislike: '👎',
  fire: '🔥',
  heart: '❤️',
  laugh: '😂',
  sad: '😢',
  angry: '😡',
};

const REACTION_LABEL: Record<string, string> = {
  like: 'begendi',
  dislike: 'begenmedim tepkisi verdi',
  fire: 'ates tepkisi verdi',
  heart: 'kalp tepkisi verdi',
  laugh: 'gulme tepkisi verdi',
  sad: 'uzgun tepkisi verdi',
  angry: 'kizgin tepkisi verdi',
};

function notifMessage(n: ForumNotification): string {
  const reactionLabel = n.reactionType ? REACTION_LABEL[n.reactionType] || 'tepki verdi' : null;

  switch (n.type) {
    case 'comment_on_topic':
      return `${n.actorUsername} konunuza yorum yapti`;
    case 'reply_to_comment':
      return `${n.actorUsername} yorumunuza yanit verdi`;
    case 'like_on_comment':
      return `${n.actorUsername} yorumunuzu ${reactionLabel || 'begendi'}`;
    case 'reaction_on_topic':
      return `${n.actorUsername} konunuza ${reactionLabel || 'tepki verdi'}`;
    default:
      return `${n.actorUsername} bir etkilesimde bulundu`;
  }
}

function notifIcon(n: ForumNotification): string {
  // Show specific emoji if reaction type is known
  if (n.reactionType && REACTION_EMOJI[n.reactionType]) {
    return REACTION_EMOJI[n.reactionType];
  }
  switch (n.type) {
    case 'comment_on_topic': return '💬';
    case 'reply_to_comment': return '↩️';
    case 'like_on_comment': return '👍';
    case 'reaction_on_topic': return '🔥';
    default: return '🔔';
  }
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<ForumNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [, setTick] = useState(0); // force re-render for time updates
  const navigate = useNavigate();
  const timerRef = useRef<number>();
  const tickRef = useRef<number>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const { count } = await apiGetUnreadCount();
      setUnreadCount(count);
    } catch {
      // ignore — user might not be logged in
    }
  }, []);

  // Poll unread count
  useEffect(() => {
    fetchCount();

    const start = () => {
      timerRef.current = window.setInterval(fetchCount, POLL_INTERVAL);
    };
    const stop = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };

    start();

    const onFocus = () => { fetchCount(); start(); };
    const onBlur = () => { stop(); };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      stop();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [fetchCount]);

  // Auto-update time labels every 30s while dropdown is open
  useEffect(() => {
    if (isOpen) {
      tickRef.current = window.setInterval(() => setTick(t => t + 1), 30_000);
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen && !loaded) {
      apiGetNotifications(50).then((data) => {
        setNotifications(data?.notifications ?? []);
        setTotal(data?.total ?? 0);
        setLoaded(true);
      }).catch(() => {
        setLoaded(true); // prevent infinite retry
      });
    }
  }, [isOpen, loaded]);

  function handleToggle() {
    if (!isOpen) setLoaded(false); // force re-fetch on next open
    setIsOpen(v => !v);
  }

  const unreadNotifs = useMemo(() => notifications.filter(n => !n.isRead), [notifications]);
  const readNotifs = useMemo(() => notifications.filter(n => n.isRead), [notifications]);

  async function handleClickNotif(n: ForumNotification) {
    if (!n.isRead) {
      try {
        await apiMarkNotificationRead(n.id);
      } catch {}
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setIsOpen(false);
    navigate(`/forum/${n.topicId}`);
  }

  async function handleMarkAllRead() {
    try {
      await apiMarkAllNotificationsRead();
    } catch {}
    setNotifications(prev => prev.map(x => ({ ...x, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      <button onClick={handleToggle} className="notif-bell-btn" aria-label="Bildirimler">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="notif-bell-icon">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Bildirimler</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="notif-mark-all-btn">
                Tumunu okundu isaretle
              </button>
            )}
          </div>
          <div className="notif-dropdown-list">
            {!loaded ? (
              <div className="notif-empty">Yukleniyor...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">Bildirim yok</div>
            ) : (
              <>
                {unreadNotifs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotif(n)}
                    className="notif-item notif-item-unread"
                  >
                    <span className="notif-avatar">
                      {notifIcon(n)}
                    </span>
                    <div className="notif-item-body">
                      <p className="notif-item-msg">{notifMessage(n)}</p>
                      <p className="notif-item-topic">{n.topicTitle}</p>
                      <p className="notif-item-time">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                ))}
                {readNotifs.length > 0 && (
                  <>
                    <div className="notif-section-title">Okunmus</div>
                    {readNotifs.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleClickNotif(n)}
                        className="notif-item"
                      >
                        <span className="notif-avatar">
                          {notifIcon(n)}
                        </span>
                        <div className="notif-item-body">
                          <p className="notif-item-msg">{notifMessage(n)}</p>
                          <p className="notif-item-topic">{n.topicTitle}</p>
                          <p className="notif-item-time">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
          {total > 50 && (
            <div className="notif-more-btn">
              {total - 50} bildirim daha var
            </div>
          )}
        </div>
      )}
    </div>
  );
}
