import { useEffect } from 'react';

export default function DetailModal({ opportunity: opp, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);

  const formatDate = (d) => {
    if (!d) return 'Not specified';
    const date = new Date(d);
    return isNaN(date) ? 'Not specified' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDesc = (text) => {
    if (!text) return 'No description available.';
    // Split pipe-delimited descriptions into readable text
    return text.replace(/\s*\|\s*/g, '. ').replace(/\.\./g, '.');
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <span className={`opp-type-badge ${opp.type}`} style={{ marginBottom: 12 }}>{opp.type}</span>
        <h2 className="modal-title">{opp.title}</h2>

        <div className="modal-meta">
          <span className="opp-source-badge">{opp.source === 'startupIndia' ? 'Startup India' : opp.source}</span>
          {opp.organizer && <span className="opp-meta-item">{opp.organizer}</span>}
          {opp.location && <span className="opp-meta-item">{opp.location}</span>}
          {opp.mode && <span className="opp-tag mode">{opp.mode}</span>}
        </div>

        {opp.description && (
          <div className="modal-section">
            <h4>Description</h4>
            <p>{formatDesc(opp.description)}</p>
          </div>
        )}

        <div className="modal-section">
          <h4>Details</h4>
          <div className="modal-details-grid">
            <div className="modal-detail-row">
              <span className="modal-detail-label">Deadline</span>
              <span className="modal-detail-value">{formatDate(opp.deadline)}</span>
            </div>
            {opp.fundingAmount && (
              <div className="modal-detail-row">
                <span className="modal-detail-label">Funding</span>
                <span className="modal-detail-value">{opp.fundingAmount}</span>
              </div>
            )}
            {opp.prize && (
              <div className="modal-detail-row">
                <span className="modal-detail-label">Prize</span>
                <span className="modal-detail-value">{opp.prize}</span>
              </div>
            )}
            {opp.equity && (
              <div className="modal-detail-row">
                <span className="modal-detail-label">Equity</span>
                <span className="modal-detail-value">{opp.equity}</span>
              </div>
            )}
          </div>
        </div>

        {((opp.sector?.length > 0) || (opp.stage?.length > 0) || (opp.tags?.length > 0)) && (
          <div className="modal-section">
            <h4>AI-Generated Tags</h4>
            <div className="modal-tags">
              {(opp.sector || []).map((s) => <span key={s} className="opp-tag sector">{s}</span>)}
              {(opp.stage || []).map((s) => <span key={s} className="opp-tag stage">{s}</span>)}
              {(opp.tags || []).map((t) => <span key={t} className="opp-tag">{t}</span>)}
            </div>
          </div>
        )}

        <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer" className="modal-apply-btn">
          Apply / View Details
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </div>
  );
}
