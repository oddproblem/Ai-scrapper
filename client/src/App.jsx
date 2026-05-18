import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import StatsCards from './components/StatsCards.jsx';
import FilterBar from './components/FilterBar.jsx';
import OpportunityGrid from './components/OpportunityGrid.jsx';
import DetailModal from './components/DetailModal.jsx';
import LoginPage from './components/LoginPage.jsx';
import AlertsPage from './components/AlertsPage.jsx';
import UrlScraper from './components/UrlScraper.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ source: '', type: '', search: '', deadline: '' });
  const [activePage, setActivePage] = useState('dashboard');
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('savedOpps') || '[]'); } catch { return []; }
  });

  // Persist saved IDs
  useEffect(() => {
    localStorage.setItem('savedOpps', JSON.stringify(savedIds));
  }, [savedIds]);

  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (data.user) setUser(data.user); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const fetchOpportunities = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 18, sortBy: 'createdAt', order: 'desc' });
      if (filters.source) params.set('source', filters.source);
      if (filters.type) params.set('type', filters.type);
      if (filters.search) params.set('search', filters.search);
      if (filters.deadline) params.set('deadline', filters.deadline);

      // Dashboard shows recent + closing soon (limited)
      if (activePage === 'dashboard') {
        params.set('limit', '9');
      }

      const res = await fetch(`/api/opportunities?${params}`, { credentials: 'include' });
      const data = await res.json();
      setOpportunities(data.opportunities || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch {
      showToast('Failed to load opportunities');
    }
    setLoading(false);
  }, [filters, activePage]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/opportunities/stats', { credentials: 'include' });
      setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    if (activePage === 'alerts') return;
    if (activePage === 'saved') {
      // Fetch saved opportunities by IDs
      if (savedIds.length === 0) {
        setOpportunities([]);
        setPagination({ page: 1, pages: 1, total: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      fetch(`/api/opportunities?limit=100`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          const saved = (data.opportunities || []).filter(o => savedIds.includes(o._id));
          setOpportunities(saved);
          setPagination({ page: 1, pages: 1, total: saved.length });
        })
        .catch(() => showToast('Failed to load saved items'))
        .finally(() => setLoading(false));
      return;
    }
    fetchOpportunities(page);
    fetchStats();
  }, [user, page, filters, activePage, fetchOpportunities, fetchStats, savedIds]);

  const handleScrape = async () => {
    setScraping(true);
    showToast('Scrape pipeline started...');
    try {
      await fetch('/api/opportunities/scrape', { method: 'POST', credentials: 'include' });
      setTimeout(() => {
        fetchOpportunities(1);
        fetchStats();
        setScraping(false);
        showToast('Scrape complete — data refreshed');
      }, 25000);
    } catch {
      setScraping(false);
      showToast('Scrape failed');
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.source) params.set('source', filters.source);
      if (filters.type) params.set('type', filters.type);
      if (filters.search) params.set('search', filters.search);
      if (filters.deadline) params.set('deadline', filters.deadline);

      const res = await fetch(`/api/opportunities/export/csv?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const csvBlob = new Blob([blob], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opportunities_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('CSV downloaded');
    } catch {
      showToast('Export failed');
    }
  };

  const toggleSave = (id) => {
    setSavedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFilterChange = (key, value) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? '' : value }));

  const clearFilters = () => {
    setFilters({ source: '', type: '', search: '', deadline: '' });
    setPage(1);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleLogout = async () => {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    setUser(null);
  };

  const handleNavigate = (pg) => {
    setActivePage(pg);
    setPage(1);
    if (pg !== 'saved') clearFilters();
  };

  if (!authChecked) {
    return <div className="loading-state"><div className="loading-dots"><span /><span /><span /></div></div>;
  }

  if (!user) {
    return <LoginPage onDevLogin={() => setUser({ displayName: 'Developer', email: 'dev@localhost', role: 'admin' })} />;
  }

  const pageTitle = {
    dashboard: 'Dashboard',
    browse: 'Browse All',
    saved: 'Saved Opportunities',
    alerts: 'Alert Settings',
  }[activePage] || 'Dashboard';

  const pageSubtitle = {
    dashboard: `${pagination.total} recent opportunities`,
    browse: `${pagination.total} opportunities across all sources`,
    saved: `${savedIds.length} bookmarked`,
    alerts: 'Manage email alerts and notification preferences',
  }[activePage] || '';

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={handleNavigate}
        onScrape={handleScrape}
        scraping={scraping}
        onLogout={handleLogout}
        savedCount={savedIds.length}
      />
      <main className="main-content">
        {activePage === 'alerts' ? (
          <AlertsPage showToast={showToast} />
        ) : (
          <>
            <Header
              title={pageTitle}
              subtitle={pageSubtitle}
              search={filters.search}
              onSearchChange={(v) => { setFilters((f) => ({ ...f, search: v })); setPage(1); }}
              onExportCSV={handleExportCSV}
              showExport={activePage !== 'saved'}
            />
            {activePage === 'dashboard' && <StatsCards stats={stats} />}
            {activePage !== 'saved' && (
              <FilterBar
                filters={filters}
                onChange={(k, v) => { handleFilterChange(k, v); setPage(1); }}
                onClear={clearFilters}
              />
            )}
            {activePage === 'browse' && (
              <UrlScraper
                onScrapeDone={() => { fetchOpportunities(1); fetchStats(); }}
                showToast={showToast}
              />
            )}
            <OpportunityGrid
              opportunities={opportunities}
              loading={loading}
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
              onSelect={setSelectedOpp}
              savedIds={savedIds}
              onToggleSave={toggleSave}
              emptyMessage={
                activePage === 'saved'
                  ? 'No saved opportunities yet. Click the bookmark icon on any card to save it.'
                  : undefined
              }
            />
          </>
        )}
      </main>
      {selectedOpp && (
        <DetailModal
          opportunity={selectedOpp}
          onClose={() => setSelectedOpp(null)}
          isSaved={savedIds.includes(selectedOpp._id)}
          onToggleSave={() => toggleSave(selectedOpp._id)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
