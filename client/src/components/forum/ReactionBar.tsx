import { useState, useRef, useEffect } from 'react';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerOpen]);

  // Visible emojis: those with count > 0 or user has reacted
  const visibleEmojis = EMOJI_MAP.filter(
    ({ type }) => reactions[type] > 0 || userReactions.includes(type)
  );

  function handlePickerReact(type: ReactionType) {
    onReact(type);
    setPickerOpen(false);
  }

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

      {/* Visible Emoji Reactions (those with count > 0) */}
      {visibleEmojis.length > 0 && (
        <div className="forum-emoji-group">
          {visibleEmojis.map(({ type, emoji }) => {
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
      )}

      {/* + Button to open emoji picker */}
      {!disabled && (
        <div className="forum-emoji-picker-wrapper" ref={pickerRef}>
          <button
            className="forum-emoji-add-btn"
            onClick={() => setPickerOpen(v => !v)}
            title="Tepki ekle"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span className="forum-emoji-plus">+</span>
          </button>

          {pickerOpen && (
            <div className="forum-emoji-picker">
              {EMOJI_MAP.map(({ type, emoji, label }) => {
                const active = userReactions.includes(type);
                return (
                  <button
                    key={type}
                    className={`forum-emoji-picker-item ${active ? 'forum-emoji-picker-active' : ''}`}
                    onClick={() => handlePickerReact(type)}
                    title={label}
                  >
                    <span className="forum-emoji-picker-emoji">{emoji}</span>
                    <span className="forum-emoji-picker-label">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
