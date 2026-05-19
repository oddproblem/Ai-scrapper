import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function AlertsPage({ showToast, userEmail }) {
  const [settings, setSettings] = useState({
    enabled: false,
    email: userEmail || '',
    keywords: '',
    types: [],
    sources: [],
    frequency: 'daily',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load preferences from backend
  useEffect(() => {
    api('/auth/alerts')
      .then(r => r.json())
      .then(data => {
        setSettings(prev => ({
          ...prev,
          enabled: data.enabled || false,
          keywords: data.keywords || '',
          types: data.types || [],
          sources: data.sources || [],
          frequency: data.frequency || 'daily',
          email: userEmail || prev.email,
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userEmail]);

  const typeOptions = ['hackathon', 'challenge', 'program', 'accelerator', 'grant', 'incubator'];
  const sourceOptions = ['devfolio', 'unstop', 'startupIndia'];
  const freqOptions = [
    { value: 'realtime', label: 'Real-time (every scrape)' },
    { value: 'daily', label: 'Daily digest' },
    { value: 'weekly', label: 'Weekly digest' },
  ];

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key, item) => {
    setSettings(prev => ({
      ...prev,
      [key]: prev[key].includes(item)
        ? prev[key].filter(x => x !== item)
        : [...prev[key], item],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api('/auth/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Alert preferences saved');
      } else {
        showToast(data.error || 'Failed to save');
      }
    } catch {
      showToast('Failed to save preferences');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="alerts-page">
        <div className="loading-state"><div className="loading-dots"><span /><span /><span /></div></div>
      </div>
    );
  }

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <div>
          <h2>Alert Settings</h2>
          <p>Configure email notifications for new opportunities matching your criteria.</p>
        </div>
      </div>

      <div className="alerts-grid">
        <div className="alert-card">
          <div className="alert-card-header">
            <h3>Notification Preferences</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="alert-field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={settings.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            <span className="alert-field-hint">Alerts will be sent to this email when new opportunities match</span>
          </div>

          <div className="alert-field">
            <label>Keywords (comma-separated)</label>
            <input
              type="text"
              placeholder="AI, blockchain, fintech, climate..."
              value={settings.keywords}
              onChange={(e) => handleChange('keywords', e.target.value)}
            />
            <span className="alert-field-hint">Get notified when opportunities match these keywords</span>
          </div>

          <div className="alert-field">
            <label>Frequency</label>
            <div className="alert-radio-group">
              {freqOptions.map(opt => (
                <label key={opt.value} className={`alert-radio ${settings.frequency === opt.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="frequency"
                    value={opt.value}
                    checked={settings.frequency === opt.value}
                    onChange={(e) => handleChange('frequency', e.target.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="alert-card">
          <h3>Filter by Type</h3>
          <p className="alert-card-desc">Only receive alerts for selected opportunity types</p>
          <div className="alert-chip-group">
            {typeOptions.map(t => (
              <button
                key={t}
                className={`filter-chip ${settings.types.includes(t) ? 'active' : ''}`}
                onClick={() => toggleArrayItem('types', t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <h3 style={{ marginTop: 24 }}>Filter by Source</h3>
          <p className="alert-card-desc">Only receive alerts from selected sources</p>
          <div className="alert-chip-group">
            {sourceOptions.map(s => (
              <button
                key={s}
                className={`filter-chip ${settings.sources.includes(s) ? 'active' : ''}`}
                onClick={() => toggleArrayItem('sources', s)}
              >
                {s === 'startupIndia' ? 'Startup India' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="alerts-save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
