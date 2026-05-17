export default function OpportunityCard({ opportunity, onClick, isSaved, onToggleSave }) {
  const opp = opportunity;

  const isClosingSoon = opp.deadline && (() => {
    const diff = new Date(opp.deadline) - new Date();
    return diff > 0 && diff < 7 * 864e5;
  })();

  const formatDeadline = (d) => {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date)) return null;
    const diff = date - new Date();
    if (diff < 0) return 'Expired';
    const days = Math.ceil(diff / 864e5);
    if (days <= 1) return 'Tomorrow';
    if (days <= 7) return `${days} days left`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDesc = (text) => {
    if (!text) return 'No description available.';
    return text.replace(/\s*\|\s*/g, '. ').replace(/\.\./g, '.');
  };

  const deadline = formatDeadline(opp.deadline);
  const sectors = (opp.sector || []).slice(0, 2);
  const stages = (opp.stage || []).slice(0, 1);
  const tags = (opp.tags || []).slice(0, 3);

  const handleSave = (e) => {
    e.stopPropagation();
    onToggleSave(opp._id);
  };

  return (
    <div className="opp-card" onClick={() => onClick(opp)}>
      <div className="opp-card-top">
        <span className={`opp-type-badge ${opp.type}`}>{opp.type}</span>
        <div className="opp-card-actions">
          <button
            className={`opp-save-btn ${isSaved ? 'saved' : ''}`}
            onClick={handleSave}
            title={isSaved ? 'Remove from saved' : 'Save opportunity'}
          >
            <svg viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <span className="opp-source-badge">
            {opp.source === 'startupIndia' ? 'Startup India' : opp.source}
          </span>
        </div>
      </div>

      <h3 className="opp-card-title">{opp.title}</h3>
      <p className="opp-card-desc">{formatDesc(opp.description)}</p>

      <div className="opp-card-meta">
        {deadline && (
          <span className={`opp-meta-item ${isClosingSoon ? 'closing-soon' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {deadline}
          </span>
        )}
        {opp.location && (
          <span className="opp-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {opp.location}
          </span>
        )}
        {opp.mode && (
          <span className="opp-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            {opp.mode}
          </span>
        )}
      </div>

      <div className="opp-card-tags">
        {sectors.map((s) => <span key={s} className="opp-tag sector">{s}</span>)}
        {stages.map((s) => <span key={s} className="opp-tag stage">{s}</span>)}
        {tags.map((t) => <span key={t} className="opp-tag">{t}</span>)}
      </div>
    </div>
  );
}
