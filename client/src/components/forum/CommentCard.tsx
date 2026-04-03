import { useState, useEffect } from 'react';
import { ForumComment, ReactionType } from '../../lib/forum-types';
import { apiToggleReaction, apiDeleteComment, apiUpdateComment } from '../../lib/forum-api';
import { useAuth } from '../../contexts/AuthContext';
import ReactionBar from './ReactionBar';
import UserProfileCard from './UserProfileCard';

interface Props {
  comment: ForumComment;
  onReply: (parentId: number) => void;
  onDeleted: (id: number) => void;
  onUpdated: (comment: ForumComment) => void;
  isLocked: boolean;
}

function timeAgo(dateStr: string): string {
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

export default function CommentCard({ comment, onReply, onDeleted, onUpdated, isLocked }: Props) {
  const { user, isAdmin } = useAuth();
  const [c, setC] = useState(comment);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  // Sync local state when parent prop changes (e.g. from polling)
  useEffect(() => {
    setC(comment);
  }, [comment]);

  const isOwner = user?.id === c.userId;
  const canModify = isOwner || isAdmin;

  async function handleReact(type: ReactionType) {
    if (!user) return;
    try {
      const res = await apiToggleReaction(c.id, type);
      setC(prev => ({
        ...prev,
        reactions: res.reactions,
        userReactions: res.userReactions,
        netLikes: res.netLikes,
      }));
    } catch {}
  }

  async function handleDelete() {
    if (!confirm('Bu yorumu silmek istediginizden emin misiniz?')) return;
    try {
      await apiDeleteComment(c.id);
      onDeleted(c.id);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleEdit() {
    if (!editBody.trim()) return;
    try {
      const res = await apiUpdateComment(c.id, editBody.trim());
      setC(prev => ({ ...prev, body: res.comment.body, updatedAt: res.comment.updatedAt }));
      onUpdated({ ...c, body: res.comment.body, updatedAt: res.comment.updatedAt });
      setEditing(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className={`forum-comment-card ${c.parentId ? 'forum-comment-reply' : ''}`}>
      <div className="forum-comment-header">
        <UserProfileCard userId={c.userId} username={c.username} userRole={c.userRole} userTitle={c.userTitle}>
          <span className="forum-comment-author">
            <span className={`forum-user-badge ${c.userRole === 'admin' ? 'forum-user-admin' : ''}`}>
              {c.userRole === 'admin' ? '★' : '•'}
            </span>
            <span className="forum-comment-username">{c.username}</span>
            {c.userTitle && <span className="forum-user-title">{c.userTitle}</span>}
          </span>
        </UserProfileCard>
        <span className="forum-comment-time">{timeAgo(c.createdAt)}</span>
      </div>

      {editing ? (
        <div className="forum-edit-area">
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            className="forum-comment-textarea"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleEdit} className="forum-submit-btn text-xs">Kaydet</button>
            <button onClick={() => { setEditing(false); setEditBody(c.body); }} className="forum-cancel-btn text-xs">Iptal</button>
          </div>
        </div>
      ) : (
        <>
          <p className="forum-comment-body">{c.body}</p>
          {c.imagePath && (
            <img src={c.imagePath} alt="Yorum gorseli" className="forum-comment-image" loading="lazy" />
          )}
        </>
      )}

      <div className="forum-comment-footer">
        <ReactionBar
          reactions={c.reactions}
          userReactions={c.userReactions}
          netLikes={c.netLikes}
          onReact={handleReact}
          disabled={!user}
        />
        <div className="forum-comment-actions">
          {user && !isLocked && (
            <button onClick={() => onReply(c.id)} className="forum-action-link">Yanıtla</button>
          )}
          {canModify && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="forum-action-link">Duzenle</button>
              <button onClick={handleDelete} className="forum-action-link forum-action-danger">Sil</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
