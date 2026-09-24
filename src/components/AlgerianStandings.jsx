import React, { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { computeStandings } from '../services/algerianStandings.js';
import TeamCrest from './TeamCrest.jsx';

// Renders the ranked standings table for one division (+ group, when the
// division has sub-groups) of "البطولة الجزائرية", computed from that
// division's own finished results only. Only shown once a specific
// division (and group, if applicable) is selected, since standings mix
// meaninglessly across separate divisions/groups.
export default function AlgerianStandings({ results, divisionSelected, groupNeeded, groupSelected }) {
  const { t } = useLanguage();

  const rows = useMemo(() => computeStandings(results), [results]);

  const formatRatio = (value) => {
    if (value === null) return '—';
    if (value === Infinity) return '∞';
    return value.toFixed(2);
  };

  const canShowTable = divisionSelected && (!groupNeeded || groupSelected);

  return (
    <div className="algerian-standings">
      <h3 className="algerian-matches-column-title">{t('algerianMatches', 'standingsTitle')}</h3>
      {canShowTable && rows.length === 0 && (
        <p className="algerian-matches-empty">{t('algerianMatches', 'standingsEmpty')}</p>
      )}
      {canShowTable && rows.length > 0 && (
        <div className="table-scroll algerian-standings-scroll">
          <table className="data-table algerian-standings-table">
            <thead>
              <tr>
                <th>{t('algerianMatches', 'colRank')}</th>
                <th>{t('algerianMatches', 'colTeam')}</th>
                <th>{t('algerianMatches', 'colPoints')}</th>
                <th>{t('algerianMatches', 'colPlayed')}</th>
                <th>{t('algerianMatches', 'colWins')}</th>
                <th>{t('algerianMatches', 'colLosses')}</th>
                <th>{t('algerianMatches', 'colSetsFor')}</th>
                <th>{t('algerianMatches', 'colSetsAgainst')}</th>
                <th>{t('algerianMatches', 'colSetCoeff')}</th>
                <th>{t('algerianMatches', 'colPointsFor')}</th>
                <th>{t('algerianMatches', 'colPointsAgainst')}</th>
                <th>{t('algerianMatches', 'colPointCoeff')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.team}>
                  <td>{row.rank}</td>
                  <td>
                    <div className="algerian-standings-team">
                      <TeamCrest name={row.team} size={26} />
                      <span>{row.team}</span>
                    </div>
                  </td>
                  <td className="algerian-standings-points">{row.points}</td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.setsWon}</td>
                  <td>{row.setsLost}</td>
                  <td>{formatRatio(row.setRatio)}</td>
                  <td>{row.hasPointData ? row.pointsFor : '—'}</td>
                  <td>{row.hasPointData ? row.pointsAgainst : '—'}</td>
                  <td>{formatRatio(row.pointRatio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
