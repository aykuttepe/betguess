import { Link } from 'react-router-dom';
import { ForumTopic } from '../../lib/forum-types';
import UserProfileCard from './UserProfileCard';

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

interface Props {
  topic: ForumTopic;
}

export default function TopicCard({ topic }: Props) {
  return (
    <Link to={`/forum/${topic.id}`} className="forum-topic-card">
      <div className="forum-topic-card-inner">
        {/* Badges + Tags */}
        <div className="forum-topic-badges">
          {topic.isPinned && <span className="forum-badge forum-badge-pin">📌 Sabit</span>}
          {topic.isLocked && <span className="forum-badge forum-badge-lock">🔒 Kilitli</span>}
          {topic.tags?.map(tag => (
            <span key={tag} className="forum-badge forum-badge-tag">{tag}</span>
          ))}
        </div>

        {/* Title */}
        <h3 className="forum-topic-title">{topic.title}</h3>

        {/* Preview body */}
        <p className="forum-topic-preview">
          {topic.body.length > 150 ? topic.body.slice(0, 150) + '...' : topic.body}
        </p>

        {/* Meta */}
        <div className="forum-topic-meta">
          <div className="forum-topic-author" onClick={e => e.preventDefault()}>
            <UserProfileCard userId={topic.userId} username={topic.username} userRole={topic.userRole} userTitle={topic.userTitle}>
              <span className="forum-topic-author-inner">
                <span className={`forum-user-badge ${topic.userRole === 'admin' ? 'forum-user-admin' : ''}`}>
                  {topic.userRole === 'admin' ? '★' : '•'}
                </span>
                <span>{topic.username}</span>
                {topic.userTitle && <span className="forum-user-title">{topic.userTitle}</span>}
              </span>
            </UserProfileCard>
          </div>
          <div className="forum-topic-stats">
            <span className="forum-topic-views">
              👁 {topic.viewCount}
            </span>
            <span className="forum-topic-comments">
              💬 {topic.commentCount}
            </span>
            <span className="forum-topic-time">
              {timeAgo(topic.lastCommentAt || topic.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
