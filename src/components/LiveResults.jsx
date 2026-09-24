import React, { useMemo, useState } from 'react';
import useRevealObserver from '../hooks/useRevealObserver.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useLiveResults } from '../hooks/useVolleyballApi.js';
import { filterOutAlgerian } from '../services/algerianFilter.js';
import Flag from './Flag.jsx';

const INITIAL_VISIBLE = 4;

export default function LiveResults() {
  const { t, locale } = useLanguage();
  const { matches: rawMatches, loading, error, rateLimited, stale, configured, refetch } = useLiveResults();
  // Global section — strictly international. Algerian national team,
  // Algerian league, and local club matches are filtered out here and
  // rendered exclusively in the dedicated AlgerianMatches section instead.
  const matches = useMemo(() => filterOutAlgerian(rawMatches), [rawMatches]);
  const [activeTab, setActiveTab] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const leagues = useMemo(() => {
    const names = Array.from(new Set(matches.map((m) => m.competition))).filter(Boolean);
    return names;
  }, [matches]);

  const filtered = activeTab === 'all' ? matches : matches.filter((m) => m.competition === activeTab);
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE);
  const gridRef = useRevealObserver([activeTab, visible.length]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowAll(false);
  };

  return (
    <section className="results-section" id="live-results">
      <div className="container">
        <h2 className="section-title">{t('liveResults', 'title')}</h2>

        {!configured && !loading && (
          <div className="api-status-card">
            <p className="api-status-title">{t('liveResults', 'notConfiguredTitle')}</p>
            <p className="api-status-body">{t('liveResults', 'notConfiguredBody')}</p>
          </div>
        )}

        {configured && rateLimited && (
          <div className="api-status-card api-status-warning">
            <p className="api-status-title">{t('liveResults', 'rateLimitedTitle')}</p>
            <p className="api-status-body">{t('liveResults', 'rateLimitedBody')}</p>
            <button className="btn-secondary" onClick={refetch}>{t('liveResults', 'retry')}</button>
          </div>
        )}

        {configured && !rateLimited && error && (
          <div className="api-status-card api-status-error">
            <p className="api-status-title">{t('liveResults', 'errorTitle')}</p>
            <p className="api-status-body">{error}</p>
            <button className="btn-secondary" onClick={refetch}>{t('liveResults', 'retry')}</button>
          </div>
        )}

        {configured && !error && !rateLimited && loading && (
          <div className="api-status-card">
            <p className="api-status-title">{t('liveResults', 'loading')}</p>
          </div>
        )}

        {configured && !error && !rateLimited && !loading && (
          <>
            {leagues.length > 1 && (
              <div className="tabs-bar">
                <button
                  className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => handleTabChange('all')}
                >
                  {t('liveResults', 'tabAll')}
                </button>
                {leagues.map((league) => (
                  <button
                    key={league}
                    className={`tab-btn ${activeTab === league ? 'active' : ''}`}
                    onClick={() => handleTabChange(league)}
                  >
                    {league}
                  </button>
                ))}
              </div>
            )}

            <div className="results-grid" ref={gridRef}>
              {visible.map((match, index) => (
                <div className="match-card reveal" key={match.id} style={{ transitionDelay: `${index * 0.06}s` }}>
                  <div className="match-card-top">
                    <span className="badge badge-cyan">
                      {match.leagueFlag ? `${match.leagueFlag} ` : ''}{match.competition}
                    </span>
                    {match.status === 'live' ? (
                      <span className="match-status-live">
                        <span className="live-dot" /> {t('liveResults', 'liveNow')}
                      </span>
                    ) : (
                      <span className="match-status-finished">{t('liveResults', 'finished')}</span>
                    )}
                  </div>

                  <div className="match-teams">
                    <div className="match-team">
                      <Flag url={match.flagUrlA} alt={match.teamA} />
                      <span className="team-name">{match.teamA}</span>
                    </div>

                    <div className="match-score">
                      <span className="score-main">{match.scoreA} - {match.scoreB}</span>
                      <span className="vs-label">{t('liveResults', 'finalScoreLabel')}</span>
                    </div>

                    <div className="match-team">
                      <Flag url={match.flagUrlB} alt={match.teamB} />
                      <span className="team-name">{match.teamB}</span>
                    </div>
                  </div>

                  {match.sets.length > 0 && (
                    <div className="match-sets">
                      {match.sets.map((set, i) => (
                        <span className="set-pill" key={i}>{t('liveResults', 'setPrefix')}{i + 1}: {set}</span>
                      ))}
                    </div>
                  )}

                  <div className="match-meta">
                    <span>{formatDate(match.date)}</span>
                    <span>{match.venue}</span>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <p style={{ color: 'var(--gray-text)' }}>{t('liveResults', 'noResults')}</p>
              )}
            </div>

            {filtered.length > INITIAL_VISIBLE && (
              <div className="show-all-wrap">
                <button className="show-all-btn" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
                  {showAll ? t('common', 'showLess') : t('common', 'showAll')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
