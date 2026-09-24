// Maps a national team's name (as returned by the volleyball API) to its
// ISO 3166-1 alpha-2 code, so we can render a real flag image from
// FlagCDN (https://flagcdn.com — free, no API key, CORS-friendly <img>
// URLs). Club teams (e.g. domestic league matches) won't match anything
// here, which is expected — see getTeamFlagUrl() below.

const COUNTRY_CODE_MAP = {
  afghanistan: 'af', albania: 'al', algeria: 'dz', 'algérie': 'dz', andorra: 'ad', angola: 'ao',
  argentina: 'ar', armenia: 'am', australia: 'au', austria: 'at', azerbaijan: 'az',
  bahrain: 'bh', bangladesh: 'bd', belarus: 'by', belgium: 'be', 'belgique': 'be', benin: 'bj',
  bolivia: 'bo', 'bosnia and herzegovina': 'ba', botswana: 'bw', brazil: 'br', 'brésil': 'br',
  bulgaria: 'bg', 'burkina faso': 'bf', burundi: 'bi', cambodia: 'kh', cameroon: 'cm',
  canada: 'ca', 'cape verde': 'cv', chad: 'td', chile: 'cl', china: 'cn', colombia: 'co',
  'costa rica': 'cr', croatia: 'hr', cuba: 'cu', cyprus: 'cy', czechia: 'cz', 'czech republic': 'cz',
  denmark: 'dk', 'dominican republic': 'do', ecuador: 'ec', egypt: 'eg', 'égypte': 'eg',
  'el salvador': 'sv', estonia: 'ee', ethiopia: 'et', fiji: 'fj', finland: 'fi', france: 'fr',
  gabon: 'ga', georgia: 'ge', germany: 'de', 'allemagne': 'de', ghana: 'gh', greece: 'gr',
  guatemala: 'gt', guinea: 'gn', haiti: 'ht', honduras: 'hn', hungary: 'hu', iceland: 'is',
  india: 'in', indonesia: 'id', iran: 'ir', iraq: 'iq', ireland: 'ie', israel: 'il', italy: 'it',
  'italie': 'it', 'ivory coast': 'ci', 'côte d ivoire': 'ci', jamaica: 'jm', japan: 'jp',
  'japon': 'jp', jordan: 'jo', kazakhstan: 'kz', kenya: 'ke', kosovo: 'xk', kuwait: 'kw',
  kyrgyzstan: 'kg', laos: 'la', latvia: 'lv', lebanon: 'lb', libya: 'ly', liechtenstein: 'li',
  lithuania: 'lt', luxembourg: 'lu', madagascar: 'mg', malawi: 'mw', malaysia: 'my', mali: 'ml',
  malta: 'mt', mexico: 'mx', 'mexique': 'mx', moldova: 'md', monaco: 'mc', mongolia: 'mn',
  montenegro: 'me', morocco: 'ma', 'maroc': 'ma', mozambique: 'mz', myanmar: 'mm', namibia: 'na',
  nepal: 'np', netherlands: 'nl', 'pays-bas': 'nl', 'new zealand': 'nz', nicaragua: 'ni',
  niger: 'ne', nigeria: 'ng', 'north korea': 'kp', 'north macedonia': 'mk', norway: 'no',
  oman: 'om', pakistan: 'pk', panama: 'pa', paraguay: 'py', peru: 'pe', 'pérou': 'pe',
  philippines: 'ph', poland: 'pl', 'pologne': 'pl', portugal: 'pt', 'puerto rico': 'pr',
  qatar: 'qa', romania: 'ro', russia: 'ru', 'russie': 'ru', rwanda: 'rw',
  'saudi arabia': 'sa', senegal: 'sn', 'sénégal': 'sn', serbia: 'rs', 'serbie': 'rs',
  singapore: 'sg', slovakia: 'sk', slovenia: 'si', 'south africa': 'za', 'south korea': 'kr',
  'korea republic': 'kr', 'korea south': 'kr', spain: 'es', 'espagne': 'es', 'sri lanka': 'lk',
  sudan: 'sd', sweden: 'se', switzerland: 'ch', 'suisse': 'ch', syria: 'sy', taiwan: 'tw',
  'chinese taipei': 'tw', tajikistan: 'tj', tanzania: 'tz', thailand: 'th', togo: 'tg',
  tunisia: 'tn', 'tunisie': 'tn', turkey: 'tr', 'türkiye': 'tr', turkiye: 'tr', turkmenistan: 'tm',
  uganda: 'ug', ukraine: 'ua', 'united arab emirates': 'ae', uae: 'ae',
  'united kingdom': 'gb', england: 'gb', 'great britain': 'gb',
  'united states': 'us', usa: 'us', 'united states of america': 'us', 'états-unis': 'us',
  uruguay: 'uy', uzbekistan: 'uz', venezuela: 've', vietnam: 'vn', 'viet nam': 'vn',
  yemen: 'ye', zambia: 'zm', zimbabwe: 'zw', 'dominican rep': 'do', 'bosnia': 'ba',
  'dr congo': 'cd', congo: 'cg', 'democratic republic of the congo': 'cd',
  'hong kong': 'hk', macau: 'mo', 'republic of korea': 'kr', scotland: 'gb', wales: 'gb',
};

// Tokens that commonly appear appended/prepended to a national team's name
// in volleyball fixtures (e.g. "Hungary Women", "Algeria U17", "Spain U20
// Women") but aren't part of the country name itself — stripped before
// lookup so the base country still resolves correctly.
const QUALIFIER_PATTERN = new RegExp(
  [
    '\\bu-?\\d{1,2}\\b', // u17, u-17, u20...
    '\\bwomen\\b', '\\bwoman\\b', '\\bladies\\b', '\\bgirls\\b', '\\bfemale\\b',
    '\\bmen\\b', '\\bmale\\b', '\\bboys\\b',
    '\\bnational team\\b', '\\bnational\\b', '\\bteam\\b',
    '\\bsenior[s]?\\b', '\\byouth\\b', '\\bjunior[s]?\\b',
    '\\bvolleyball\\b', '\\bvolley\\b',
    '\\ba\\b', '\\bb\\b', // "Team A" / "Team B" style qualifiers
  ].join('|'),
  'gi'
);

function normalizeName(name) {
  let s = String(name || '').toLowerCase().trim();
  s = s.replace(QUALIFIER_PATTERN, ' ');
  s = s.replace(/[^\p{L}\p{N} ]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Returns a real FlagCDN image URL for a national team name, or null if
// the name isn't a recognized country (e.g. a club team name) — callers
// should fall back to a neutral icon in that case rather than guessing.
export function getTeamFlagUrl(teamName) {
  const code = COUNTRY_CODE_MAP[normalizeName(teamName)];
  if (!code) return null;
  return `https://flagcdn.com/w40/${code}.png`;
}

export function getCountryFlagUrl(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return null;
  const code = countryCode.toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return null;
  return `https://flagcdn.com/w40/${code}.png`;
}

// Returns true when a team name resolves to a recognized *non-Algerian*
// national side (e.g. "Tunisia", "تونس", "France"...). Used to keep the
// strictly-local Algerian Matches section free of any foreign national
// team, club, or opponent — see services/algerianFilter.js.
export function isForeignCountryName(teamName) {
  const code = COUNTRY_CODE_MAP[normalizeName(teamName)];
  return Boolean(code) && code !== 'dz';
}
