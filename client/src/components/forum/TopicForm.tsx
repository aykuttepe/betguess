import { useState, useRef } from 'react';
import { FORUM_TAGS } from '../../lib/forum-types';

interface Props {
  onSubmit: (title: string, body: string, image?: File, tags?: string[]) => Promise<void>;
  onCancel: () => void;
  initialTitle?: string;
  initialBody?: string;
  initialTags?: string[];
  submitText?: string;
}

export default function TopicForm({ onSubmit, onCancel, initialTitle = '', initialBody = '', initialTags = [], submitText = 'Konu Olustur' }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 3 ? [...prev, tag] : prev
    );
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu en fazla 5MB olabilir.');
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(title.trim(), body.trim(), image || undefined, selectedTags);
    } catch (err: any) {
      alert(err.message || 'Hata olustu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="forum-topic-form">
      <h2 className="forum-form-title">Yeni Konu Olustur</h2>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Konu basligi"
        className="forum-input"
        maxLength={200}
        autoFocus
      />

      {/* Tag selector */}
      <div className="forum-tag-selector">
        <label className="forum-tag-label">Etiketler <span className="forum-tag-hint">(en fazla 3)</span></label>
        <div className="forum-tag-options">
          {FORUM_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`forum-tag-option ${selectedTags.includes(tag) ? 'forum-tag-selected' : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Iceriginizi yazin..."
        className="forum-textarea"
        rows={6}
      />

      {preview && (
        <div className="forum-image-preview-wrap">
          <img src={preview} alt="Preview" className="forum-image-preview" />
          <button type="button" onClick={clearImage} className="forum-image-remove">✕</button>
        </div>
      )}

      <div className="forum-form-actions">
        <label className="forum-upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Gorsel Ekle
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageChange}
            ref={fileRef}
            className="hidden"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="forum-cancel-btn">Iptal</button>
          <button type="submit" disabled={!title.trim() || !body.trim() || loading} className="forum-submit-btn">
            {loading ? 'Olusturuluyor...' : submitText}
          </button>
        </div>
      </div>
    </form>
  );
}
