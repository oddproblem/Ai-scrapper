export default function StatsCards({ stats }) {
  const s = stats || { total: 0, active: 0, closingSoon: 0, bySource: {} };
  const sourceCount = Object.keys(s.bySource || {}).length;

  const cards = [
    {
      label: 'Total Opportunities',
      value: s.total,
      sub: 'Across all sources',
      cls: 'total',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
    },
    {
      label: 'Active',
      value: s.active,
      sub: 'Currently open',
      cls: 'active',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    },
    {
      label: 'Closing Soon',
      value: s.closingSoon,
      sub: 'Within 7 days',
      cls: 'closing',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label: 'Sources',
      value: `${sourceCount}/3`,
      sub: Object.entries(s.bySource || {}).map(([src, cnt]) => `${src}: ${cnt}`).join(' · ') || 'No data yet',
      cls: 'sources',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c) => (
        <div key={c.cls} className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{c.label}</span>
            <div className={`stat-card-icon ${c.cls}`}>{c.icon}</div>
          </div>
          <div className="stat-card-value">{c.value}</div>
          <div className="stat-card-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
