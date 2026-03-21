import { ReactionSummary, ReactionType } from '../../lib/forum-types';

const EMOJI_MAP: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'fire', emoji: '🔥', label: 'Ates' },
  { type: 'heart', emoji: '❤️', label: 'Kalp' },
  { type: 'laugh', emoji: '😂', label: 'Gulme' },
  { type: 'sad', emoji: '😢', label: 'Uzgun' },
  { type: 'angry', emoji: '😡', label: 'Kizgin' },
];

interface Props {
  reactions: ReactionSummary;
  userReactions: string[];
  netLikes: number;
  onReact: (type: ReactionType) => void;
  disabled?: boolean;
}

export default function ReactionBar({ reactions, userReactions, netLikes, onReact, disabled }: Props) {
  const hasLiked = userReactions.includes('like');
  const hasDisliked = userReactions.includes('dislike');

  return (
    <div className="forum-reaction-bar">
      {/* Like / Dislike */}
      <div className="forum-vote-group">
        <button
          className={`forum-vote-btn ${hasLiked ? 'forum-vote-active-like' : ''}`}
          onClick={() => onReact('like')}
          disabled={disabled}
          title="Begendim"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
            <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
        </button>
        <span className={`forum-vote-count ${netLikes > 0 ? 'text-emerald-400' : netLikes < 0 ? 'text-red-400' : 'text-gray-400'}`}>
          {netLikes}
        </span>
        <button
          className={`forum-vote-btn ${hasDisliked ? 'forum-vote-active-dislike' : ''}`}
          onClick={() => onReact('dislike')}
          disabled={disabled}
          title="Begenmedim"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" style={{ transform: 'rotate(180deg)' }}>
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
            <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
        </button>
      </div>

      {/* Emoji Reactions */}
      <div className="forum-emoji-group">
        {EMOJI_MAP.map(({ type, emoji }) => {
          const count = reactions[type];
          const active = userReactions.includes(type);
          return (
            <button
              key={type}
              className={`forum-emoji-btn ${active ? 'forum-emoji-active' : ''}`}
              onClick={() => onReact(type)}
              disabled={disabled}
              title={type}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="forum-emoji-count">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
