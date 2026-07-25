import { PAGE_SIZE } from "../data/cards";

export function Pagination({
  page,
  hasMore,
  shown,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  shown: number;
  onPage: (page: number) => void;
}) {
  if (page === 0 && !hasMore) return null;
  const first = page * PAGE_SIZE + 1;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ← Previous
      </button>
      <span className="page-range">
        {shown > 0 ? `${first}–${first + shown - 1}` : "No cards"}
      </span>
      <button type="button" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </nav>
  );
}
