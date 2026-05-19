import { useState } from 'react';
import { api } from '../api.js';

export default function UrlScraper({ onScrapeDone, showToast }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleScrape = async () => {
    if (!url.trim()) return;
    
    // Basic URL validation
    try { new URL(url); } catch {
      showToast('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await api('/api/opportunities/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scrape failed');

      setResult(data);
      showToast(data.message);
      if (data.saved > 0 && onScrapeDone) {
        onScrapeDone(); // refresh the main list
      }
    } catch (err) {
      showToast(err.message || 'Failed to scrape URL');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScrape();
  };

  return (
    <div className="url-scraper">
      <div className="url-scraper-input-row">
        <div className="url-scraper-input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <input
            type="url"
            placeholder="Paste any URL to scrape opportunities from it..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
        </div>
        <button
          className="url-scraper-btn"
          onClick={handleScrape}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <span className="url-scraper-spinner" />
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Scrape
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="url-scraper-result">
          <div className="url-scraper-result-summary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{result.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
