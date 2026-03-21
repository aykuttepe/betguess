import { useState, useRef, useEffect, useCallback } from 'react';
import { UserForumProfile } from '../../lib/forum-types';
import { apiGetUserForumProfile } from '../../lib/forum-api';

interface Props {
  userId: number;
  username: string;
  userRole?: string;
  userTitle?: string | null;
  children?: React.ReactNode;
}

// Simple in-memory cache to avoid re-fetching on every hover
const profileCache: Record<number, { data: UserForumProfile; ts: number }> = {};
const CACHE_TTL = 60_000; // 1 minute

function getRankInfo(topicCount: number, commentCount: number, likes: number): { label: string; emoji: string; color: string } {
  const score = topicCount * 3 + commentCount + likes;
  if (score >= 100) return { label: 'Efsane', emoji: '🏆', color: '#f59e0b' };
  if (score >= 50) return { label: 'Uzman', emoji: '🎯', color: '#8b5cf6' };
  if (score >= 20) return { label: 'Analist', emoji: '📊', color: '#3b82f6' };
  if (score >= 5) return { label: 'Uye', emoji: '👤', color: '#10b981' };
  return { label: 'Caylak', emoji: '🌱', color: '#6b7280' };
}

function timeAgoJoin(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Bugun';
  if (days < 30) return `${days} gun once`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay once`;
  const years = Math.floor(months / 12);
  return `${years} yil once`;
}

export default function UserProfileCard({ userId, username, userRole, userTitle, children }: Props) {
  const [show, setShow] = useState(false);
  const [profile, setProfile] = useState<UserForumProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<'bottom' | 'top'>('bottom');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProfile = useCallback(async () => {
    // Check cache
    const cached = profileCache[userId];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setProfile(cached.data);
      return;
    }

    setLoading(true);
    try {
      const data = await apiGetUserForumProfile(userId);
      profileCache[userId] = { data, ts: Date.now() };
      setProfile(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShow(true);
      fetchProfile();

      // Determine position
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setPos(spaceBelow < 260 ? 'top' : 'bottom');
      }
    }, 300);
  }

  function handleLeave() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShow(false);
    }, 200);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const rank = profile ? getRankInfo(profile.topicCount, profile.commentCount, profile.totalLikesReceived) : null;

  return (
    <span
      ref={triggerRef}
      className="forum-profile-trigger"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children || (
        <span className="forum-comment-author">
          <span className={`forum-user-badge ${userRole === 'admin' ? 'forum-user-admin' : ''}`}>
            {userRole === 'admin' ? '★' : '•'}
          </span>
          <span className="forum-comment-username">{username}</span>
          {userTitle && <span className="forum-user-title">{userTitle}</span>}
        </span>
      )}

      {show && (
        <div
          ref={cardRef}
          className={`forum-profile-card ${pos === 'top' ? 'forum-profile-card-top' : 'forum-profile-card-bottom'}`}
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleLeave}
        >
          {loading && !profile ? (
            <div className="forum-profile-loading">Yukleniyor...</div>
          ) : profile ? (
            <>
              {/* Header */}
              <div className="forum-profile-header">
                <div className="forum-profile-avatar">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
                <div className="forum-profile-info">
                  <div className="forum-profile-name-row">
                    <span className="forum-profile-name">{profile.username}</span>
                    {profile.role === 'admin' && <span className="forum-profile-admin-badge">★ Admin</span>}
                  </div>
                  {profile.title && <span className="forum-profile-title">{profile.title}</span>}
                  {rank && (
                    <span className="forum-profile-rank" style={{ color: rank.color }}>
                      {rank.emoji} {rank.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="forum-profile-stats">
                <div className="forum-profile-stat">
                  <span className="forum-profile-stat-value">{profile.topicCount}</span>
                  <span className="forum-profile-stat-label">Konu</span>
                </div>
                <div className="forum-profile-stat">
                  <span className="forum-profile-stat-value">{profile.commentCount}</span>
                  <span className="forum-profile-stat-label">Yorum</span>
                </div>
                <div className="forum-profile-stat">
                  <span className="forum-profile-stat-value">{profile.totalLikesReceived}</span>
                  <span className="forum-profile-stat-label">Begeni</span>
                </div>
              </div>

              {/* Join date */}
              <div className="forum-profile-footer">
                <span className="forum-profile-join">📅 Katilim: {timeAgoJoin(profile.createdAt)}</span>
              </div>
            </>
          ) : (
            <div className="forum-profile-loading">Profil bulunamadi.</div>
          )}
        </div>
      )}
    </span>
  );
}
