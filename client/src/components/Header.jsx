export default function Header({ title, subtitle, search, onSearchChange, onExportCSV, showExport = true }) {
  return (
    <div className="page-header">
      <div>
        <h2>{title || 'Dashboard'}</h2>
        {subtitle && <p className="page-header-sub">{subtitle}</p>}
      </div>
      <div className="header-actions">
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {showExport && (
          <button className="export-btn" onClick={onExportCSV} title="Download CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}
