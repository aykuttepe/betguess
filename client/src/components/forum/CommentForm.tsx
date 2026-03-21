import { useState, useRef } from 'react';

interface Props {
  onSubmit: (body: string, image?: File) => Promise<void>;
  placeholder?: string;
  buttonText?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}

export default function CommentForm({ onSubmit, placeholder = 'Yorumunuzu yazin...', buttonText = 'Gonder', autoFocus, onCancel }: Props) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!body.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(body.trim(), image || undefined);
      setBody('');
      clearImage();
    } catch (err: any) {
      alert(err.message || 'Hata olustu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="forum-comment-form">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={placeholder}
        className="forum-comment-textarea"
        rows={3}
        autoFocus={autoFocus}
      />
      {preview && (
        <div className="forum-image-preview-wrap">
          <img src={preview} alt="Preview" className="forum-image-preview" />
          <button type="button" onClick={clearImage} className="forum-image-remove">✕</button>
        </div>
      )}
      <div className="forum-comment-form-actions">
        <label className="forum-upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageChange}
            ref={fileRef}
            className="hidden"
          />
        </label>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="forum-cancel-btn">Iptal</button>
          )}
          <button type="submit" disabled={!body.trim() || loading} className="forum-submit-btn">
            {loading ? 'Gonderiliyor...' : buttonText}
          </button>
        </div>
      </div>
    </form>
  );
}
