import React, { useMemo, useState } from 'react';
import useRevealObserver from '../hooks/useRevealObserver.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useLiveResults, useUpcomingMatches } from '../hooks/useVolleyballApi.js';
import { filterOnlyStrictlyLocalAlgerian } from '../services/algerianFilter.js';
import { ALGERIAN_DIVISIONS } from '../data/algeriaData.js';
import TeamCrest from './TeamCrest.jsx';
import AlgerianStandings from './AlgerianStandings.jsx';

const INITIAL_VISIBLE = 3;
const ALL_FILTER = 'all';

// Normalizes a live-API match object (see volleyballApi.js normalizeMatch)
// into the same shape as an admin-entered Algerian match, so both sources
// can be merged and rendered by the exact same cards below. Live-API
// matches don't carry a division/sub-group (that categorization only
// applies to the admin-managed domestic championship structure), so
// they only ever show up under the "All" division filter.
function fromApiMatch(m) {
  return {
    id: `api-${m.id}`,
    divisionId: '',
    groupId: '',
    wilayaName: m.venue || m.competition || '',
    commune: '',
    homeTeam: m.teamA,
    awayTeam: m.teamB,
    score: m.status === 'upcoming' ? '' : `${m.scoreA}-${m.scoreB}`,
    date: m.date,
  };
}

// Public-facing display for Algerian volleyball matches. Automatically
// captures every *strictly local* Algerian match surfaced by the live API
// (filtered out of the global Live Results / Match Schedules sections —
// see services/algerianFilter.js) AND every match the admin manages in
// AdminDashboard.jsx (src/data/algeriaData.js wilayas/teams), then merges
// both sources into one feed. "Strictly local" means no foreign national
// team or club (Tunisia included) is ever shown here — only Algerian
// domestic league/club fixtures and the national team's own entries. A
// match with a filled-in score is treated as a finished result (right
// column); one without a score is an upcoming fixture (left column).
export default function AlgerianMatches({ matches, isAdminAuthenticated = false }) {
  const { t, locale } = useLanguage();
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllFixtures, setShowAllFixtures] = useState(false);
  // The top-level "الكل" (All) division tab has been removed from the UI
  // (see the tabs-bar render below), so the section now opens on the
  // first real division by default instead of the old "all" filter.
  // ALL_FILTER itself is kept (still used by the sub-group "الكل" tab
  // and by filterByDivision's internal logic) — only the initial
  // selection and the top-level button are changed.
  const [activeDivision, setActiveDivision] = useState(
    ALGERIAN_DIVISIONS.length > 0 ? ALGERIAN_DIVISIONS[0].id : ALL_FILTER
  );
  const [activeGroup, setActiveGroup] = useState(ALL_FILTER);

  const { matches: liveApiMatches } = useLiveResults();
  const { matches: upcomingApiMatches } = useUpcomingMatches();

  const adminMatches = matches || [];

  const { results: allResults, fixtures: allFixtures } = useMemo(() => {
    const apiAlgerian = [
      ...filterOnlyStrictlyLocalAlgerian(liveApiMatches).map(fromApiMatch),
      ...filterOnlyStrictlyLocalAlgerian(upcomingApiMatches).map(fromApiMatch),
    ];
    const combined = [...adminMatches, ...apiAlgerian];

    const withScore = [];
    const withoutScore = [];
    combined.forEach((m) => {
      if (m.score && m.score.trim()) withScore.push(m);
      else withoutScore.push(m);
    });
    // A match's date is optional now (see AdminDashboard.jsx), so undated
    // matches are pushed to the end of each list instead of sorting
    // unpredictably next to `new Date('')` (Invalid Date / NaN).
    const dateValue = (m) => {
      const t2 = m.date ? new Date(m.date).getTime() : NaN;
      return Number.isNaN(t2) ? null : t2;
    };
    withScore.sort((a, b) => {
      const av = dateValue(a);
      const bv = dateValue(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
    withoutScore.sort((a, b) => {
      const av = dateValue(a);
      const bv = dateValue(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
    return { results: withScore, fixtures: withoutScore };
  }, [adminMatches, liveApiMatches, upcomingApiMatches]);

  // Division/sub-group filter tabs for "البطولة الجزائرية" — lets
  // visitors browse results and upcoming fixtures by competition
  // (القسم الوطني الأول أ/ب رجال, القسم الوطني الأول سيدات, كأس
  // الجزائر أكابر, كأس الجزائر للفئات الشبانية) and, where relevant,
  // by geographic sub-group (مجموعة وسط شرق / مجموعة وسط غرب, or
  // رجال / سيدات for the Cup).
  const selectedDivision = ALGERIAN_DIVISIONS.find((d) => d.id === activeDivision);
  const filterByDivision = (list) => {
    if (activeDivision === ALL_FILTER) return list;
    return list.filter((m) => {
      if (m.divisionId !== activeDivision) return false;
      if (activeGroup === ALL_FILTER) return true;
      return m.groupId === activeGroup;
    });
  };
  const results = useMemo(() => filterByDivision(allResults), [allResults, activeDivision, activeGroup]);
  const fixtures = useMemo(() => filterByDivision(allFixtures), [allFixtures, activeDivision, activeGroup]);

  const handleDivisionChange = (id) => {
    setActiveDivision(id);
    setActiveGroup(ALL_FILTER);
    setShowAllResults(false);
    setShowAllFixtures(false);
  };
  const handleGroupChange = (id) => {
    setActiveGroup(id);
    setShowAllResults(false);
    setShowAllFixtures(false);
  };

  const visibleResults = showAllResults ? results : results.slice(0, INITIAL_VISIBLE);
  const visibleFixtures = showAllFixtures ? fixtures : fixtures.slice(0, INITIAL_VISIBLE);
  const gridRef = useRevealObserver([activeDivision, activeGroup, visibleResults.length, visibleFixtures.length]);

  // Match date is now optional (the admin can add a whole round's worth
  // of fixtures — round 1 through 18+ — before the real dates are
  // known), so this must tolerate an empty/missing date instead of
  // rendering "Invalid Date".
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const locationLabel = (m) => [m.wilayaName, m.commune].filter(Boolean).join(' — ');
  const roundLabel = (m) => m.round || '';

  return (
    <section className="algerian-matches-section" id="algerian-matches">
      <div className="container">
        <div className="algerian-title-row">
          <h2 className="section-title">{t('algerianMatches', 'title')}</h2>
        </div>

        {/* Division/section tabs — laid out horizontally, side by side, in
            one wrapping row (the previous, pre-"vertical" design). No
            per-section logos/crests are rendered anymore — see spec. */}
        <div className="tabs-bar algerian-division-tabs">
          {ALGERIAN_DIVISIONS.map((d) => (
            <button
              key={d.id}
              className={`tab-btn ${activeDivision === d.id ? 'active' : ''}`}
              onClick={() => handleDivisionChange(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {selectedDivision && selectedDivision.groups.length > 0 && (
          <div className="tabs-bar algerian-group-tabs">
            <button
              className={`tab-btn tab-btn-sm ${activeGroup === ALL_FILTER ? 'active' : ''}`}
              onClick={() => handleGroupChange(ALL_FILTER)}
            >
              {t('liveResults', 'tabAll')}
            </button>
            {selectedDivision.groups.map((g) => (
              <button
                key={g.id}
                className={`tab-btn tab-btn-sm ${activeGroup === g.id ? 'active' : ''}`}
                onClick={() => handleGroupChange(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        <AlgerianStandings
          results={results}
          divisionSelected={activeDivision !== ALL_FILTER}
          groupNeeded={Boolean(selectedDivision && selectedDivision.groups.length > 0)}
          groupSelected={activeGroup !== ALL_FILTER}
        />

        <div className="algerian-matches-grid" ref={gridRef}>
          {/* Results column — renders first in source order so it sits on
              the right in the site's default Arabic RTL layout. */}
          <div className="algerian-matches-column">
            <h3 className="algerian-matches-column-title">{t('algerianMatches', 'resultsTitle')}</h3>
            <div className="algerian-matches-list">
              {visibleResults.map((m, index) => (
                <div className="algerian-match-card reveal" key={m.id} style={{ transitionDelay: `${index * 0.06}s` }}>
                  <div className="algerian-match-teams">
                    <div className="algerian-match-team">
                      <TeamCrest name={m.homeTeam} size={40} logoUrl={m.homeTeamLogo} />
                      <span>{m.homeTeam}</span>
                    </div>
                    <div className="algerian-match-score">
                      <span className="score-main">{m.score}</span>
                      <span className="vs-label">{t('algerianMatches', 'finalScore')}</span>
                    </div>
                    <div className="algerian-match-team">
                      <TeamCrest name={m.awayTeam} size={40} logoUrl={m.awayTeamLogo} />
                      <span>{m.awayTeam}</span>
                    </div>
                  </div>
                  {/* Set-by-set breakdown (الشوط الأول..الخامس) — same
                      professional pill-row layout as the live-results
                      match cards, shown under the final score whenever
                      the admin has entered real per-set scores. */}
                  {Array.isArray(m.setScores) && m.setScores.length > 0 && (
                    <div className="algerian-match-sets-row">
                      {m.setScores.map(([h, a], i) => (
                        <span className="algerian-set-pill" key={i}>
                          {t('algerianMatches', `setLabel${i + 1}`)}: {h}-{a}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="algerian-match-meta">
                    {roundLabel(m) && <span className="badge badge-gold">{roundLabel(m)}</span>}
                    <span>{locationLabel(m)}</span>
                    {formatDate(m.date) && <span>{formatDate(m.date)}</span>}
                  </div>
                </div>
              ))}
              {results.length === 0 && (
                <p className="algerian-matches-empty">{t('algerianMatches', 'noResults')}</p>
              )}
            </div>
            {results.length > INITIAL_VISIBLE && (
              <div className="show-all-wrap">
                <button className="show-all-btn" onClick={() => setShowAllResults((s) => !s)} aria-expanded={showAllResults}>
                  {showAllResults ? t('common', 'showLess') : t('common', 'showAll')}
                </button>
              </div>
            )}
          </div>

          {/* Fixtures column — renders second, sitting on the left in RTL. */}
          <div className="algerian-matches-column">
            <h3 className="algerian-matches-column-title">{t('algerianMatches', 'fixturesTitle')}</h3>
            <div className="algerian-matches-list">
              {visibleFixtures.map((m, index) => (
                <div className="algerian-match-card reveal" key={m.id} style={{ transitionDelay: `${index * 0.06}s` }}>
                  <div className="algerian-match-teams">
                    <div className="algerian-match-team">
                      <TeamCrest name={m.homeTeam} size={40} logoUrl={m.homeTeamLogo} />
                      <span>{m.homeTeam}</span>
                    </div>
                    <span className="algerian-match-vs">{t('algerianMatches', 'vsLabel')}</span>
                    <div className="algerian-match-team">
                      <TeamCrest name={m.awayTeam} size={40} logoUrl={m.awayTeamLogo} />
                      <span>{m.awayTeam}</span>
                    </div>
                  </div>
                  <div className="algerian-match-meta">
                    {roundLabel(m) && <span className="badge badge-gold">{roundLabel(m)}</span>}
                    <span>{locationLabel(m)}</span>
                    {(formatDate(m.date) || m.time) && (
                      <span>{formatDate(m.date)}{formatDate(m.date) && m.time ? ' · ' : ''}{m.time || ''}</span>
                    )}
                    <span className="badge badge-cyan">{t('algerianMatches', 'upcoming')}</span>
                  </div>
                </div>
              ))}
              {fixtures.length === 0 && (
                <p className="algerian-matches-empty">{t('algerianMatches', 'noFixtures')}</p>
              )}
            </div>
            {fixtures.length > INITIAL_VISIBLE && (
              <div className="show-all-wrap">
                <button className="show-all-btn" onClick={() => setShowAllFixtures((s) => !s)} aria-expanded={showAllFixtures}>
                  {showAllFixtures ? t('common', 'showLess') : t('common', 'showAll')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
