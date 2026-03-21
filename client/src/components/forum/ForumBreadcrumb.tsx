import { Link } from 'react-router-dom';

interface ForumBreadcrumbProps {
  category?: string | null;
  title?: string;
}

export default function ForumBreadcrumb({
  category,
  title,
}: ForumBreadcrumbProps) {
  return (
    <nav aria-label="Forum breadcrumb" className="forum-breadcrumb">
      <Link to="/forum" className="forum-breadcrumb-link">
        Forum
      </Link>
      {category && (
        <>
          <span className="forum-breadcrumb-separator">/</span>
          <Link
            to={`/forum?tag=${encodeURIComponent(category)}#forum-kategoriler`}
            className="forum-breadcrumb-link"
          >
            {category}
          </Link>
        </>
      )}
      {title && (
        <>
          <span className="forum-breadcrumb-separator">/</span>
          <span className="forum-breadcrumb-current">{title}</span>
        </>
      )}
    </nav>
  );
}
