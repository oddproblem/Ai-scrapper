import OpportunityCard from './OpportunityCard.jsx';

export default function OpportunityGrid({ opportunities, loading, pagination, onPageChange, onSelect, savedIds = [], onToggleSave, emptyMessage }) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!opportunities.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <h3>No opportunities found</h3>
        <p>{emptyMessage || 'Try adjusting your filters or run the scraper to fetch new data.'}</p>
      </div>
    );
  }

  const { page, pages } = pagination;

  return (
    <>
      <div className="opp-grid">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp._id}
            opportunity={opp}
            onClick={onSelect}
            isSaved={savedIds.includes(opp._id)}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>

      {pages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            let p;
            if (pages <= 7) p = i + 1;
            else if (page <= 4) p = i + 1;
            else if (page >= pages - 3) p = pages - 6 + i;
            else p = page - 3 + i;
            return (
              <button key={p} className={p === page ? 'active' : ''} onClick={() => onPageChange(p)}>
                {p}
              </button>
            );
          })}
          <button disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
