const SOURCES = ['devfolio', 'unstop', 'startupIndia', 'custom'];
const TYPES = ['hackathon', 'accelerator', 'grant', 'challenge', 'incubator', 'program'];
const DEADLINES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'expired', label: 'Expired' },
];

export default function FilterBar({ filters, onChange, onClear }) {
  const hasFilters = filters.source || filters.type || filters.deadline;

  return (
    <div className="filter-bar">
      <span className="filter-label">Source</span>
      {SOURCES.map((s) => (
        <button
          key={s}
          className={`filter-chip source-${s} ${filters.source === s ? 'active' : ''}`}
          onClick={() => onChange('source', s)}
        >
          {s === 'startupIndia' ? 'Startup India' : s === 'custom' ? 'Custom URL' : s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}

      <span className="filter-divider" />

      <span className="filter-label">Type</span>
      {TYPES.map((t) => (
        <button
          key={t}
          className={`filter-chip ${filters.type === t ? 'active' : ''}`}
          onClick={() => onChange('type', t)}
        >
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}

      <span className="filter-divider" />

      <span className="filter-label">Deadline</span>
      {DEADLINES.map((d) => (
        <button
          key={d.value}
          className={`filter-chip ${filters.deadline === d.value ? 'active' : ''}`}
          onClick={() => onChange('deadline', d.value)}
        >
          {d.label}
        </button>
      ))}

      {hasFilters && (
        <button className="filter-clear" onClick={onClear}>Clear filters</button>
      )}
    </div>
  );
}
