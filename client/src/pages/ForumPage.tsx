import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ForumTopic, TopicSort, FORUM_TAGS } from '../lib/forum-types';
import { apiListTopics, apiCreateTopic } from '../lib/forum-api';
import { useAuth } from '../contexts/AuthContext';
import TopicCard from '../components/forum/TopicCard';
import TopicForm from '../components/forum/TopicForm';

const SORT_OPTIONS: { key: TopicSort; label: string }[] = [
  { key: 'active', label: 'Tum Konular' },
  { key: 'popular', label: 'Populer' },
  { key: 'newest', label: 'Yeni' },
  { key: 'oldest', label: 'En Eski' },
  { key: 'most_viewed', label: 'En Cok Goruntulen' },
  { key: 'most_liked', label: 'En Cok Begeni Alan' },
];

const DATE_OPTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tum Zamanlar' },
  { key: 'today', label: 'Bugun' },
  { key: '7d', label: 'Son 7 Gun' },
  { key: '30d', label: 'Son 30 Gun' },
];

export default function ForumPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [sort, setSort] = useState<TopicSort>((searchParams.get('sort') as TopicSort) || 'active');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [activeTags, setActiveTags] = useState<string[]>(() => {
    const t = searchParams.get('tag');
    return t ? t.split(',').filter(Boolean) : [];
  });
  const [dateRange, setDateRange] = useState(searchParams.get('dateRange') || 'all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Ref to track if debounce effect should skip initial render
  const isInitialMount = useRef(true);
  const isFirstLoad = useRef(true);
  const pollRef = useRef<number>();
  const POLL_INTERVAL = 15_000; // 15 seconds

  const loadTopics = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    try {
      const data = await apiListTopics(page, 20, search || undefined, sort, activeTags.length > 0 ? activeTags : undefined, dateRange);
      setTopics(data.topics);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      isFirstLoad.current = false;
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, activeTags, dateRange]);

  // Initial load + auto-poll for live updates
  useEffect(() => {
    loadTopics();

    const startPoll = () => {
      pollRef.current = window.setInterval(loadTopics, POLL_INTERVAL);
    };
    const stopPoll = () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };

    startPoll();

    const onFocus = () => { loadTopics(); startPoll(); };
    const onBlur = () => { stopPoll(); };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      stopPoll();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [loadTopics]);

  // Live search debounce
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Don't search for 1 character
    if (searchInput.length === 1) return;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
      syncParams({ q: searchInput, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  function syncParams(overrides: { page?: number; q?: string; sort?: TopicSort; tag?: string; dateRange?: string } = {}) {
    const params: Record<string, string> = {};
    const s = overrides.sort ?? sort;
    const q = overrides.q ?? search;
    const p = overrides.page ?? page;
    const t = overrides.tag !== undefined ? overrides.tag : activeTags.join(',');
    const dr = overrides.dateRange ?? dateRange;
    if (s && s !== 'active') params.sort = s;
    if (q) params.q = q;
    if (p > 1) params.page = String(p);
    if (t) params.tag = t;
    if (dr && dr !== 'all') params.dateRange = dr;
    setSearchParams(params);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
    syncParams({ page: 1, q: searchInput });
  }

  function handleSortChange(newSort: TopicSort) {
    setSort(newSort);
    setPage(1);
    syncParams({ sort: newSort, page: 1 });
  }

  function handleTagChange(tag: string) {
    const newTags = activeTags.includes(tag)
      ? activeTags.filter(t => t !== tag)
      : [...activeTags, tag];
    setActiveTags(newTags);
    setPage(1);
    syncParams({ tag: newTags.join(','), page: 1 });
  }

  function handleDateRangeChange(range: string) {
    setDateRange(range);
    setPage(1);
    syncParams({ dateRange: range, page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    syncParams({ page: newPage });
  }

  // Filter summary helpers
  const hasActiveFilters = activeTags.length > 0 || search || dateRange !== 'all';

  function removeTag(tag: string) {
    const newTags = activeTags.filter(t => t !== tag);
    setActiveTags(newTags);
    setPage(1);
    syncParams({ tag: newTags.join(','), page: 1 });
  }

  function clearSearch() {
    setSearch('');
    setSearchInput('');
    setPage(1);
    syncParams({ q: '', page: 1 });
  }

  function clearDateRange() {
    setDateRange('all');
    setPage(1);
    syncParams({ dateRange: 'all', page: 1 });
  }

  function clearAllFilters() {
    setActiveTags([]);
    setSearch('');
    setSearchInput('');
    setDateRange('all');
    setPage(1);
    syncParams({ tag: '', q: '', dateRange: 'all', page: 1 });
  }

  async function handleCreateTopic(title: string, body: string, image?: File, tags?: string[]) {
    const res = await apiCreateTopic(title, body, image, tags);
    setShowForm(false);
    navigate(`/forum/${res.topic.id}`);
  }

  return (
    <div className="forum-page">
      {/* Header */}
      <div className="forum-header">
        <div className="forum-header-left">
          <h1 className="forum-page-title">Forum</h1>
          <span className="forum-topic-count">{total} konu</span>
        </div>
        {user && (
          <button onClick={() => setShowForm(true)} className="forum-new-topic-btn">
            + Yeni Konu
          </button>
        )}
      </div>

      {/* Create topic form */}
      {showForm && (
        <TopicForm
          onSubmit={handleCreateTopic}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Search — live search, no button needed */}
      <form onSubmit={handleSearch} className="forum-search-form">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Konu, takim veya analiz ara..."
          className="forum-search-input"
        />
      </form>

      {/* Sort + Tag filter — combined row */}
      <div id="forum-kategoriler" className="forum-tag-filter scroll-mt-36">
        {/* Sıralama chipleri */}
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={`sort-${key}`}
            onClick={() => handleSortChange(key)}
            className={`forum-sort-chip ${sort === key ? 'forum-sort-chip-active' : ''}`}
          >
            {label}
          </button>
        ))}
        <span className="forum-filter-divider">|</span>
        {/* Etiket chipleri */}
        {FORUM_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => handleTagChange(tag)}
            className={`forum-tag-chip ${activeTags.includes(tag) ? 'forum-tag-chip-active' : ''}`}
          >
            {tag}
            {activeTags.includes(tag) && <span className="forum-tag-chip-x">✕</span>}
          </button>
        ))}
      </div>

      {/* Date range filter */}
      <div className="forum-date-filter">
        {DATE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleDateRangeChange(key)}
            className={`forum-date-chip ${dateRange === key ? 'forum-date-chip-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active filter summary bar */}
      {hasActiveFilters && (
        <div className="forum-filter-summary">
          {activeTags.map(tag => (
            <span key={tag} className="forum-filter-chip">
              {tag}
              <button onClick={() => removeTag(tag)} className="forum-filter-chip-x">✕</button>
            </span>
          ))}
          {search && (
            <span className="forum-filter-chip">
              Arama: &ldquo;{search}&rdquo;
              <button onClick={clearSearch} className="forum-filter-chip-x">✕</button>
            </span>
          )}
          {dateRange !== 'all' && (
            <span className="forum-filter-chip">
              {DATE_OPTIONS.find(d => d.key === dateRange)?.label}
              <button onClick={clearDateRange} className="forum-filter-chip-x">✕</button>
            </span>
          )}
          <button onClick={clearAllFilters} className="forum-filter-clear-all">
            Tumunu Temizle
          </button>
        </div>
      )}

      {/* Topic list */}
      {loading ? (
        <div className="forum-loading">Yukleniyor...</div>
      ) : topics.length === 0 ? (
        <div className="forum-empty">
          {search || activeTags.length > 0 || dateRange !== 'all'
            ? 'Filtrelere uyan konu bulunamadi.'
            : 'Henuz konu olusturulmamis.'}
          {!search && activeTags.length === 0 && dateRange === 'all' && user && (
            <button onClick={() => setShowForm(true)} className="forum-new-topic-btn mt-4">
              Ilk konuyu sen olustur!
            </button>
          )}
        </div>
      ) : (
        <div className="forum-topic-list">
          {topics.map(t => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="forum-pagination">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="forum-page-btn"
          >
            ← Onceki
          </button>
          <span className="forum-page-info">{page} / {totalPages}</span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="forum-page-btn"
          >
            Sonraki →
          </button>
        </div>
      )}

      {/* Info for guests */}
      {!user && (
        <div className="forum-guest-notice">
          Yorum yapmak ve konu olusturmak icin <a href="/login" className="forum-login-link">giris yapin</a>.
        </div>
      )}
    </div>
  );
}
