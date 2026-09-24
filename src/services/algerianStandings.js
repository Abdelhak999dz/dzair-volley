// Standings (ترتيب) calculator for "البطولة الجزائرية".
//
// Consumes the same admin-entered match objects already rendered by
// AlgerianMatches.jsx (divisionId, groupId, homeTeam, awayTeam, score)
// and turns every *finished* match (one with a non-empty `score`) into a
// ranked table, applying the exact points / tie-break rules requested:
//
//   1) Match points:
//        - 3-0 or 3-1  → winner 3 pts, loser 0 pts
//        - 3-2         → winner 2 pts, loser 1 pt
//        - Forfeit/walkover → winner 3 pts and a fixed 25-0/25-0/25-0
//          set line, loser 0 pts (same point split as a normal 3-0)
//   2) Tie-break order (strict, each level only used if the previous is
//      exactly equal):
//        a. Total points (desc)
//        b. Total wins (desc)
//        c. Set ratio = sets won / sets lost (desc; ratio is treated as
//           +Infinity — i.e. best possible — when sets lost is 0, so no
//           division by zero ever occurs)
//        d. Point ratio = total rally points scored / total rally points
//           conceded (desc; same divide-by-zero guard). This only uses
//           real numbers where they're actually known (see note below).
//        e. Team name, as a final deterministic, stable fallback.
//
// A NOTE ON POINT RATIO: the admin-entered `score` field for this section
// is a single free-text set score (e.g. "3-1") — there is no per-set
// rally-point entry (e.g. 25-20, 25-18...) anywhere in the data model, and
// this file intentionally does not add one (that would mean touching the
// Admin Dashboard / match entry form, which is outside this section's
// standings scope). So real point-ratio numbers are only ever available
// for forfeited matches, where the rules fix the line at 25-0 per set
// (deterministic, no guessing). For ordinary matches we simply have
// nothing to add for that tier, which is the honest behaviour — we never
// fabricate a rally score. If a match object ever *does* carry a
// `setScores` array (e.g. [[25,20],[25,18],[22,25],[25,19]]), it is used
// automatically and takes priority over any forfeit inference.

const SET_SCORE_PATTERN = /(\d+)\s*[-:]\s*(\d+)/;
const FORFEIT_KEYWORDS = ['انسحاب', 'غياب', 'خ.م', 'w.o', 'wo'];

// Parses the free-text `score` field ("3-1", "3-0 (انسحاب)", ...) into the
// set counts for each side plus a forfeit flag. Returns null when the
// text doesn't contain a recognizable "X-Y" set score (e.g. still empty /
// upcoming fixture).
function parseSetScore(scoreText) {
  if (!scoreText) return null;
  const text = String(scoreText).trim();
  const match = text.match(SET_SCORE_PATTERN);
  if (!match) return null;
  const homeSets = parseInt(match[1], 10);
  const awaySets = parseInt(match[2], 10);
  if (Number.isNaN(homeSets) || Number.isNaN(awaySets)) return null;
  if (homeSets === awaySets) return null; // volleyball sets can't tie
  const lower = text.toLowerCase();
  const isForfeit = FORFEIT_KEYWORDS.some((kw) => lower.includes(kw));
  return { homeSets, awaySets, isForfeit };
}

// Match-points split for a given (winnerSets, loserSets) pair, per the
// requested rules: only a 3-2-style one-set margin splits 2/1, everything
// else (including forfeits, which are always 3-0) is a clean 3/0.
function matchPointsSplit(winnerSets, loserSets) {
  const wentTheDistance = loserSets === 2 && winnerSets - loserSets === 1;
  return wentTheDistance ? { winner: 2, loser: 1 } : { winner: 3, loser: 0 };
}

// Rally-points (for/against) contribution for a single match, when known.
// Real per-set data (`setScores`) always wins; a forfeit falls back to the
// fixed 25-0 × N sets line mandated by the rules; anything else
// contributes nothing (both null) — see note above.
function rallyPointsFor(match, homeSets, awaySets, isForfeit) {
  if (Array.isArray(match.setScores) && match.setScores.length > 0) {
    let home = 0;
    let away = 0;
    match.setScores.forEach(([h, a]) => {
      home += Number(h) || 0;
      away += Number(a) || 0;
    });
    return { home, away };
  }
  if (isForfeit) {
    const winnerSets = Math.max(homeSets, awaySets);
    const homeWon = homeSets > awaySets;
    return {
      home: homeWon ? winnerSets * 25 : 0,
      away: homeWon ? 0 : winnerSets * 25,
    };
  }
  return { home: null, away: null };
}

function emptyRow(team) {
  return {
    team,
    played: 0,
    wins: 0,
    losses: 0,
    points: 0,
    setsWon: 0,
    setsLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    hasPointData: false,
  };
}

function setRatio(row) {
  if (row.setsLost === 0) return row.setsWon > 0 ? Infinity : 0;
  return row.setsWon / row.setsLost;
}

function pointRatio(row) {
  if (!row.hasPointData) return null;
  if (row.pointsAgainst === 0) return row.pointsFor > 0 ? Infinity : 0;
  return row.pointsFor / row.pointsAgainst;
}

// Builds the ranked standings table for one already-filtered list of
// matches (i.e. matches belonging to a single division + group — mixing
// divisions would make "who played whom" meaningless). Only matches with
// a parsable finished score count; upcoming fixtures are ignored.
export function computeStandings(matches) {
  const table = new Map();

  const ensureRow = (team) => {
    if (!team) return null;
    if (!table.has(team)) table.set(team, emptyRow(team));
    return table.get(team);
  };

  (matches || []).forEach((m) => {
    if (!m.homeTeam || !m.awayTeam) return;
    const parsed = parseSetScore(m.score);
    if (!parsed) return; // upcoming / unscored fixture — not part of the table
    const { homeSets, awaySets, isForfeit } = parsed;

    const home = ensureRow(m.homeTeam);
    const away = ensureRow(m.awayTeam);
    if (!home || !away) return;

    const homeWon = homeSets > awaySets;
    const winnerSets = homeWon ? homeSets : awaySets;
    const loserSets = homeWon ? awaySets : homeSets;
    const split = matchPointsSplit(winnerSets, loserSets);
    const rally = rallyPointsFor(m, homeSets, awaySets, isForfeit);

    home.played += 1;
    away.played += 1;
    home.setsWon += homeSets;
    home.setsLost += awaySets;
    away.setsWon += awaySets;
    away.setsLost += homeSets;

    if (homeWon) {
      home.wins += 1;
      home.points += split.winner;
      away.losses += 1;
      away.points += split.loser;
    } else {
      away.wins += 1;
      away.points += split.winner;
      home.losses += 1;
      home.points += split.loser;
    }

    if (rally.home !== null) {
      home.pointsFor += rally.home;
      home.pointsAgainst += rally.away;
      home.hasPointData = true;
      away.pointsFor += rally.away;
      away.pointsAgainst += rally.home;
      away.hasPointData = true;
    }
  });

  const rows = Array.from(table.values()).map((row) => ({
    ...row,
    setRatio: setRatio(row),
    pointRatio: pointRatio(row),
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;
    const aRatio = a.pointRatio === null ? -Infinity : a.pointRatio;
    const bRatio = b.pointRatio === null ? -Infinity : b.pointRatio;
    if (bRatio !== aRatio) return bRatio - aRatio;
    return a.team.localeCompare(b.team, 'ar');
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
