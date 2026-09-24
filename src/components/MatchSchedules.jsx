import React, { useState, useEffect, useMemo } from 'react';
import useRevealObserver from '../hooks/useRevealObserver.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useUpcomingMatches } from '../hooks/useVolleyballApi.js';
import { filterOutAlgerian } from '../services/algerianFilter.js';
import Flag from './Flag.jsx';

const INITIAL_VISIBLE = 4;

function getTimeLeft(targetDateStr) {
  const target = new Date(targetDateStr).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, expired: false };
}

const Countdown = React.memo(function Countdown({ targetDate, t }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.expired) {
    return (
      <div className="countdown">
        <div className="countdown-box">
          <span className="num">🏐</span>
          <span className="lbl">{t('schedules', 'live')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="countdown">
      <div className="countdown-box">
        <span className="num">{timeLeft.days}</span>
        <span className="lbl">{t('schedules', 'days')}</span>
      </div>
      <div className="countdown-box">
        <span className="num">{timeLeft.hours}</span>
        <span className="lbl">{t('schedules', 'hours')}</span>
      </div>
      <div className="countdown-box">
        <span className="num">{timeLeft.minutes}</span>
        <span className="lbl">{t('schedules', 'minutes')}</span>
      </div>
      <div className="countdown-box">
        <span className="num">{timeLeft.seconds}</span>
        <span className="lbl">{t('schedules', 'seconds')}</span>
      </div>
    </div>
  );
});

export default function MatchSchedules() {
  const { t, locale } = useLanguage();
  const { matches: rawSchedules, loading, error, rateLimited, stale, configured, refetch } = useUpcomingMatches();
  // Global section — strictly international. Algerian fixtures are
  // filtered out here and rendered exclusively in AlgerianMatches instead.
  const schedules = useMemo(() => filterOutAlgerian(rawSchedules), [rawSchedules]);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? schedules : schedules.slice(0, INITIAL_VISIBLE);
  const listRef = useRevealObserver([visible.length]);

  const formatDateBox = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString(locale, { day: '2-digit' });
    const month = d.toLocaleDateString(locale, { month: 'short' });
    return { day, month };
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <section className="schedule-section" id="schedules">
      <div className="container">
        <h2 className="section-title">{t('schedules', 'title')}</h2>

        {!configured && !loading && (
          <div className="api-status-card">
            <p className="api-status-title">{t('schedules', 'notConfiguredTitle')}</p>
            <p className="api-status-body">{t('schedules', 'notConfiguredBody')}</p>
          </div>
        )}

        {configured && rateLimited && (
          <div className="api-status-card api-status-warning">
            <p className="api-status-title">{t('schedules', 'rateLimitedTitle')}</p>
            <p className="api-status-body">{t('schedules', 'rateLimitedBody')}</p>
            <button className="btn-secondary" onClick={refetch}>{t('schedules', 'retry')}</button>
          </div>
        )}

        {configured && !rateLimited && error && (
          <div className="api-status-card api-status-error">
            <p className="api-status-title">{t('schedules', 'errorTitle')}</p>
            <p className="api-status-body">{error}</p>
            <button className="btn-secondary" onClick={refetch}>{t('schedules', 'retry')}</button>
          </div>
        )}

        {configured && !error && !rateLimited && loading && (
          <div className="api-status-card">
            <p className="api-status-title">{t('schedules', 'loading')}</p>
          </div>
        )}

        {configured && !error && !rateLimited && !loading && (
          <>
            <div className="schedule-list" ref={listRef}>
              {visible.map((match, index) => {
                const { day, month } = formatDateBox(match.date);
                return (
                  <div className="schedule-card reveal" key={match.id} style={{ transitionDelay: `${index * 0.06}s` }}>
                    <div className="schedule-date-box">
                      <span className="day">{day}</span>
                      <span className="month">{month}</span>
                    </div>

                    <div className="schedule-teams">
                      <Flag url={match.flagUrlA} alt={match.teamA} />
                      <span>{match.teamA}</span>
                      <span className="vs">VS</span>
                      <Flag url={match.flagUrlB} alt={match.teamB} />
                      <span>{match.teamB}</span>
                    </div>

                    <div className="schedule-info">
                      <span className="competition">
                        {match.leagueFlag ? `${match.leagueFlag} ` : ''}{match.competition}
                      </span>
                      <span className="venue">{match.venue} — {formatTime(match.date)}</span>
                    </div>

                    <Countdown targetDate={match.date} t={t} />
                  </div>
                );
              })}

              {schedules.length === 0 && (
                <p style={{ color: 'var(--gray-text)' }}>{t('schedules', 'noSchedules')}</p>
              )}
            </div>

            {schedules.length > INITIAL_VISIBLE && (
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
