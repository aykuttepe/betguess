import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ForumTopic, ForumComment, CommentSort, FORUM_TAGS, ReactionType } from '../lib/forum-types';
import {
  apiGetTopic, apiCreateComment, apiDeleteTopic, apiUpdateTopic,
  apiTogglePin, apiToggleLock, apiToggleTopicReaction,
} from '../lib/forum-api';
import { useAuth } from '../contexts/AuthContext';
import CommentCard from '../components/forum/CommentCard';
import CommentForm from '../components/forum/CommentForm';
import ForumBreadcrumb from '../components/forum/ForumBreadcrumb';
import UserProfileCard from '../components/forum/UserProfileCard';
import ReactionBar from '../components/forum/ReactionBar';

export default function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [sort, setSort] = useState<CommentSort>('hype');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const topicId = parseInt(id || '0');
  const pollRef = useRef<number>();
  const POLL_INTERVAL = 10_000; // 10 seconds

  const loadTopic = useCallback(async (silent = false) => {
    if (!topicId) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiGetTopic(topicId, sort);
      setTopic(data.topic);
      setComments(data.comments);
    } catch (err: any) {
      if (!silent) setError(err.message || 'Konu yuklenemedi.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [topicId, sort]);

  // Initial load + auto-poll for live updates
  useEffect(() => {
    loadTopic();

    const startPoll = () => {
      pollRef.current = window.setInterval(() => loadTopic(true), POLL_INTERVAL);
    };
    const stopPoll = () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };

    startPoll();

    // Pause polling when tab is not visible, resume on focus
    const onFocus = () => { loadTopic(true); startPoll(); };
    const onBlur = () => { stopPoll(); };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      stopPoll();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [loadTopic]);

  async function handleComment(body: string, image?: File) {
    if (!topic) return;
    const res = await apiCreateComment(topic.id, body, undefined, image);
    setComments(prev => [res.comment, ...prev]);
    setTopic(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
  }

  async function handleReply(body: string, image?: File) {
    if (!topic || !replyTo) return;
    const res = await apiCreateComment(topic.id, body, replyTo, image);
    setComments(prev => [...prev, res.comment]);
    setTopic(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
    setReplyTo(null);
  }

  async function handleDeleteTopic() {
    if (!topic || !confirm('Bu konuyu silmek istediginizden emin misiniz?')) return;
    try {
      await apiDeleteTopic(topic.id);
      navigate('/forum');
    } catch (err: any) {
      alert(err.message);
    }
  }

  function toggleEditTag(tag: string) {
    setEditTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 3 ? [...prev, tag] : prev
    );
  }

  async function handleEditTopic() {
    if (!topic) return;
    try {
      const res = await apiUpdateTopic(topic.id, editTitle, editBody, editTags);
      setTopic(res.topic);
      setEditing(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handlePin() {
    if (!topic) return;
    const res = await apiTogglePin(topic.id);
    setTopic(prev => prev ? { ...prev, isPinned: res.pinned } : prev);
  }

  async function handleLock() {
    if (!topic) return;
    const res = await apiToggleLock(topic.id);
    setTopic(prev => prev ? { ...prev, isLocked: res.locked } : prev);
  }

  async function handleTopicReact(type: ReactionType) {
    if (!user || !topic) return;
    try {
      const res = await apiToggleTopicReaction(topic.id, type);
      setTopic(prev => prev ? {
        ...prev,
        reactions: res.reactions,
        userReactions: res.userReactions,
        netLikes: res.netLikes,
      } : prev);
    } catch {}
  }

  function handleCommentDeleted(commentId: number) {
    setComments(prev => prev.filter(c => c.id !== commentId));
    setTopic(prev => prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev);
  }

  function handleCommentUpdated(updated: ForumComment) {
    setComments(prev => prev.map(c => c.id === updated.id ? { ...c, body: updated.body, updatedAt: updated.updatedAt } : c));
  }

  // Group comments into parent + replies (threaded)
  const parentComments = useMemo(() => comments.filter(c => !c.parentId), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<number, ForumComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const list = map.get(c.parentId) || [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    return map;
  }, [comments]);

  function toggleReplies(parentId: number) {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  // Auto-expand replies when replying
  function handleReplyClick(parentId: number) {
    setReplyTo(parentId);
    setExpandedReplies(prev => new Set(prev).add(parentId));
  }

  if (loading) return <div className="forum-page"><div className="forum-loading">Yukleniyor...</div></div>;
  if (error || !topic) return (
    <div className="forum-page">
      <div className="forum-empty">{error || 'Konu bulunamadi.'}</div>
      <Link to="/forum" className="forum-back-link">← Forum'a don</Link>
    </div>
  );

  const isOwner = user?.id === topic.userId;
  const canModify = isOwner || isAdmin;
  const primaryTag = topic.tags?.[0] || null;

  return (
    <div className="forum-page">
      <ForumBreadcrumb category={primaryTag} title={topic.title} />

      {/* Topic */}
      <div className="forum-topic-detail">
        {/* Badges + Tags */}
        <div className="forum-topic-badges">
          {topic.isPinned && <span className="forum-badge forum-badge-pin">📌 Sabit</span>}
          {topic.isLocked && <span className="forum-badge forum-badge-lock">🔒 Kilitli</span>}
          {topic.tags?.map(tag => (
            <Link key={tag} to={`/forum?tag=${encodeURIComponent(tag)}`} className="forum-badge forum-badge-tag" onClick={e => e.stopPropagation()}>
              {tag}
            </Link>
          ))}
        </div>

        {editing ? (
          <div className="forum-edit-area">
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="forum-input mb-2"
            />
            <div className="forum-tag-selector" style={{ margin: '0.5rem 0' }}>
              <label className="forum-tag-label">Etiketler <span className="forum-tag-hint">(en fazla 3)</span></label>
              <div className="forum-tag-options">
                {FORUM_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleEditTag(tag)}
                    className={`forum-tag-option ${editTags.includes(tag) ? 'forum-tag-selected' : ''}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              className="forum-textarea"
              rows={5}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleEditTopic} className="forum-submit-btn">Kaydet</button>
              <button onClick={() => setEditing(false)} className="forum-cancel-btn">Iptal</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="forum-detail-title">{topic.title}</h1>
            <div className="forum-detail-meta">
              <div className="forum-topic-author">
                <UserProfileCard userId={topic.userId} username={topic.username} userRole={topic.userRole} userTitle={topic.userTitle}>
                  <span className="forum-topic-author-inner">
                    <span className={`forum-user-badge ${topic.userRole === 'admin' ? 'forum-user-admin' : ''}`}>
                      {topic.userRole === 'admin' ? '★' : '•'}
                    </span>
                    <span className="font-medium">{topic.username}</span>
                    {topic.userTitle && <span className="forum-user-title">{topic.userTitle}</span>}
                  </span>
                </UserProfileCard>
              </div>
              <div className="forum-detail-meta-right">
                <span className="forum-detail-views">👁 {topic.viewCount} goruntuleme</span>
                <span className="forum-comment-time">
                  {new Date(topic.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="forum-detail-body">{topic.body}</div>
            {topic.imagePath && (
              <img src={topic.imagePath} alt="Konu gorseli" className="forum-topic-image" loading="lazy" />
            )}
            <div className="forum-topic-reactions">
              <ReactionBar
                reactions={topic.reactions || { like: 0, dislike: 0, fire: 0, heart: 0, laugh: 0, sad: 0, angry: 0 }}
                userReactions={topic.userReactions || []}
                netLikes={topic.netLikes ?? 0}
                onReact={handleTopicReact}
                disabled={!user}
              />
            </div>
          </>
        )}

        {/* Topic actions */}
        {canModify && !editing && (
          <div className="forum-topic-actions">
            <button onClick={() => { setEditing(true); setEditTitle(topic.title); setEditBody(topic.body); setEditTags(topic.tags || []); }} className="forum-action-link">Duzenle</button>
            <button onClick={handleDeleteTopic} className="forum-action-link forum-action-danger">Sil</button>
            {isAdmin && (
              <>
                <button onClick={handlePin} className="forum-action-link">{topic.isPinned ? 'Sabiti Kaldir' : 'Sabitle'}</button>
                <button onClick={handleLock} className="forum-action-link">{topic.isLocked ? 'Kilidi Ac' : 'Kilitle'}</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Comments section */}
      <div className="forum-comments-section">
        <div className="forum-comments-header">
          <h2 className="forum-comments-title">Yorumlar ({topic.commentCount})</h2>
          <div className="forum-sort-group">
            {(['hype', 'newest', 'oldest'] as CommentSort[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`forum-sort-btn ${sort === s ? 'forum-sort-active' : ''}`}
              >
                {s === 'hype' ? '🔥 Hype' : s === 'newest' ? '🕐 Yeni' : '📅 Eski'}
              </button>
            ))}
          </div>
        </div>

        {/* New comment form */}
        {user && !topic.isLocked && (
          <CommentForm onSubmit={handleComment} placeholder="Yorumunuzu yazin..." />
        )}

        {topic.isLocked && (
          <div className="forum-locked-notice">🔒 Bu konu kilitlenmis. Yeni yorum yapilamaz.</div>
        )}

        {!user && (
          <div className="forum-guest-notice">
            Yorum yapmak icin <a href="/login" className="forum-login-link">giris yapin</a>.
          </div>
        )}

        {/* Comment list — threaded */}
        {comments.length === 0 ? (
          <div className="forum-empty-comments">Henuz yorum yapilmamis.</div>
        ) : (
          <div className="forum-comment-list">
            {parentComments.map(c => {
              const replies = repliesByParent.get(c.id) || [];
              const replyCount = replies.length;
              const isExpanded = expandedReplies.has(c.id);

              return (
                <div key={c.id} className="forum-comment-thread">
                  <CommentCard
                    comment={c}
                    onReply={handleReplyClick}
                    onDeleted={handleCommentDeleted}
                    onUpdated={handleCommentUpdated}
                    isLocked={topic.isLocked}
                  />

                  {/* Reply toggle button */}
                  {replyCount > 0 && (
                    <button
                      className="forum-replies-toggle"
                      onClick={() => toggleReplies(c.id)}
                    >
                      <span className="forum-replies-toggle-line" />
                      <span className="forum-replies-toggle-text">
                        {isExpanded ? '▲ Yanitlari gizle' : `▼ ${replyCount} yanit goster`}
                      </span>
                    </button>
                  )}

                  {/* Replies (collapsible) */}
                  {isExpanded && replyCount > 0 && (
                    <div className="forum-replies-list">
                      {replies.map(reply => (
                        <CommentCard
                          key={reply.id}
                          comment={reply}
                          onReply={handleReplyClick}
                          onDeleted={handleCommentDeleted}
                          onUpdated={handleCommentUpdated}
                          isLocked={topic.isLocked}
                        />
                      ))}
                    </div>
                  )}

                  {/* Reply form */}
                  {replyTo === c.id && user && (
                    <div className="forum-reply-form-wrap">
                      <CommentForm
                        onSubmit={handleReply}
                        placeholder={`@${c.username} icin yanitiniz...`}
                        buttonText="Yanitla"
                        autoFocus
                        onCancel={() => setReplyTo(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
