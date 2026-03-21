import { Link } from 'react-router-dom';
import { ForumTopic } from '../../lib/forum-types';
import UserProfileCard from './UserProfileCard';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az once';
  if (mins < 60) return `${mins}dk once`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa once`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g once`;
  return new Date(dateStr).toLocaleDateString('tr-TR');
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
