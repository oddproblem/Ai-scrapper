export default function Sidebar({ user, activePage, onNavigate, onScrape, scraping, onLogout, savedCount }) {
  const initials = user?.displayName?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'browse', label: 'Browse All', icon: 'search' },
    { id: 'saved', label: 'Saved', icon: 'bookmark', badge: savedCount || 0 },
  ];

  const icons = {
    grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
    bookmark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
    refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    spinner: <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
    logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <div>
          <h1>Startup Aggregator</h1>
          <span>AI-Powered Discovery</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-link ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {icons[item.icon]}
            {item.label}
            {item.badge > 0 && <span className="sidebar-badge">{item.badge}</span>}
          </button>
        ))}

        <div className="sidebar-section-title">Actions</div>

        <button className="sidebar-scrape-btn" onClick={onScrape} disabled={scraping}>
          {scraping ? icons.spinner : icons.refresh}
          {scraping ? 'Scraping...' : 'Run Scraper'}
        </button>

        <button
          className={`sidebar-link ${activePage === 'alerts' ? 'active' : ''}`}
          onClick={() => onNavigate('alerts')}
        >
          {icons.bell}
          Alerts
        </button>
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {user?.avatar ? <img src={user.avatar} alt="" /> : initials}
        </div>
        <div className="sidebar-user-info">
          <p>{user?.displayName || 'User'}</p>
          <span>{user?.email || ''}</span>
        </div>
        <button className="sidebar-logout" onClick={onLogout} title="Logout">
          {icons.logout}
        </button>
      </div>
    </aside>
  );
}
