import { ALGERIAN_VOLLEYBALL_TEAMS, ALGERIAN_WILAYAS } from '../data/algeriaData.js';
import { isForeignCountryName } from './countryFlags.js';

// Shared keyword/entity list used to strictly isolate Algerian volleyball
// content (national team, domestic league, and local clubs) away from the
// global/international sections, and to positively capture that same
// content for the dedicated AlgerianMatches section.
//
// Keywords intentionally cover both Latin and Arabic spellings, plus every
// club/national-team name already curated in algeriaData.js, so a single
// predicate — isAlgerianMatch() — can be reused everywhere a match needs
// to be classified.
const EXTRA_KEYWORDS = [
  'algeria',
  'algerian',
  'algérie',
  'algerie',
  'الجزائر',
  'جزائري',
  'جزائرية',
  'دوري الأبطال الجزائري',
  'شباب بجاية',
  'مستقبل الرويبة',
  'مجمع صيدال',
];

// Base (parenthetical-free) team names give shorter, more reliable
// substrings to match against — e.g. "نادي شباب بجاية (NC Béjaïa)" also
// yields "نادي شباب بجاية" and "NC Béjaïa" as separate needles.
function expandTeamName(name) {
  const variants = [name];
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) {
    variants.push(parenMatch[1].trim());
    variants.push(name.replace(/\([^)]*\)/, '').trim());
  }
  return variants;
}

const KEYWORDS = Array.from(
  new Set([
    ...EXTRA_KEYWORDS,
    ...ALGERIAN_VOLLEYBALL_TEAMS.flatMap(expandTeamName),
    ...ALGERIAN_WILAYAS.map((w) => w.name),
  ])
)
  .map((k) => k.trim())
  .filter((k) => k.length > 1)
  .map((k) => k.toLowerCase());

function textContainsAlgerianKeyword(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return KEYWORDS.some((k) => lower.includes(k));
}

// Accepts a normalized match object (see volleyballApi.js normalizeMatch)
// or an admin-entered Algerian match — checks every text field that could
// carry Algeria-related content.
export function isAlgerianMatch(match) {
  if (!match) return false;
  const fields = [
    match.teamA,
    match.teamB,
    match.homeTeam,
    match.awayTeam,
    match.competition,
    match.leagueCountry,
    match.wilayaName,
    match.commune,
  ];
  return fields.some(textContainsAlgerianKeyword);
}

export function filterOutAlgerian(matches) {
  return (matches || []).filter((m) => !isAlgerianMatch(m));
}

export function filterOnlyAlgerian(matches) {
  return (matches || []).filter((m) => isAlgerianMatch(m));
}

// Stricter than isAlgerianMatch(): true only when the match has NO foreign
// national-team opponent at all (Tunisia, France, Egypt...) on either side.
// Used to keep the dedicated Algerian Matches section strictly local —
// domestic league/club fixtures and the national team's own entries only,
// with zero non-Algerian teams (Tunisia included) ever appearing there.
export function isStrictlyLocalAlgerianMatch(match) {
  if (!match) return false;
  if (!isAlgerianMatch(match)) return false;
  const opponents = [match.teamA, match.teamB, match.homeTeam, match.awayTeam];
  return !opponents.some((name) => isForeignCountryName(name));
}

export function filterOnlyStrictlyLocalAlgerian(matches) {
  return (matches || []).filter((m) => isStrictlyLocalAlgerianMatch(m));
}
