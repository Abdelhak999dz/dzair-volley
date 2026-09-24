// Reference data for the admin's "Algerian Volleyball Matches" section.
// Wilayas cover all 58 official Algerian provinces. Communes are a
// representative subset per wilaya (the provincial capital plus a few
// well-known daïras/communes) rather than an exhaustive municipal
// register, which keeps the selector usable while still being real,
// correctly-spelled Algerian place names.
export const ALGERIAN_WILAYAS = [
  { code: '01', name: 'أدرار', communes: ['أدرار', 'رقان', 'تيميمون', 'أولف'] },
  { code: '02', name: 'الشلف', communes: ['الشلف', 'الأصنام', 'أولاد فارس', 'تنس'] },
  { code: '03', name: 'الأغواط', communes: ['الأغواط', 'أفلو', 'حاسي الدلاعة'] },
  { code: '04', name: 'أم البواقي', communes: ['أم البواقي', 'عين البيضاء', 'عين مليلة'] },
  { code: '05', name: 'باتنة', communes: ['باتنة', 'بريكة', 'عين التوتة', 'أريس'] },
  { code: '06', name: 'بجاية', communes: ['بجاية', 'أقبو', 'سيدي عيش', 'أميزور'] },
  { code: '07', name: 'بسكرة', communes: ['بسكرة', 'طولقة', 'سيدي عقبة'] },
  { code: '08', name: 'بشار', communes: ['بشار', 'كنادسة', 'العبادلة'] },
  { code: '09', name: 'البليدة', communes: ['البليدة', 'بوفاريك', 'موزاية'] },
  { code: '10', name: 'البويرة', communes: ['البويرة', 'الأخضرية', 'سور الغزلان'] },
  { code: '11', name: 'تمنراست', communes: ['تمنراست', 'عين صالح', 'إن غزام'] },
  { code: '12', name: 'تبسة', communes: ['تبسة', 'الشريعة', 'بئر العاتر'] },
  { code: '13', name: 'تلمسان', communes: ['تلمسان', 'مغنية', 'الرمشي'] },
  { code: '14', name: 'تيارت', communes: ['تيارت', 'فرندة', 'السوقر'] },
  { code: '15', name: 'تيزي وزو', communes: ['تيزي وزو', 'عزازقة', 'ذراع بن خدة'] },
  { code: '16', name: 'الجزائر', communes: ['الجزائر الوسطى', 'باب الوادي', 'حسين داي', 'بئر مراد رايس'] },
  { code: '17', name: 'الجلفة', communes: ['الجلفة', 'حاسي بحبح', 'عين وسارة'] },
  { code: '18', name: 'جيجل', communes: ['جيجل', 'الطاهير', 'الميلية'] },
  { code: '19', name: 'سطيف', communes: ['سطيف', 'العلمة', 'عين ولمان'] },
  { code: '20', name: 'سعيدة', communes: ['سعيدة', 'يوب', 'عين الحجر'] },
  { code: '21', name: 'سكيكدة', communes: ['سكيكدة', 'عزابة', 'القل'] },
  { code: '22', name: 'سيدي بلعباس', communes: ['سيدي بلعباس', 'تلاغ', 'رأس الماء'] },
  { code: '23', name: 'عنابة', communes: ['عنابة', 'الحجار', 'برحال'] },
  { code: '24', name: 'قالمة', communes: ['قالمة', 'وادي الزناتي', 'حمام دباغ'] },
  { code: '25', name: 'قسنطينة', communes: ['قسنطينة', 'الخروب', 'حامة بوزيان'] },
  { code: '26', name: 'المدية', communes: ['المدية', 'البرواقية', 'قصر البخاري'] },
  { code: '27', name: 'مستغانم', communes: ['مستغانم', 'عين تادلس', 'سيدي علي'] },
  { code: '28', name: 'المسيلة', communes: ['المسيلة', 'بوسعادة', 'سيدي عيسى'] },
  { code: '29', name: 'معسكر', communes: ['معسكر', 'المحمدية', 'سيق'] },
  { code: '30', name: 'ورقلة', communes: ['ورقلة', 'حاسي مسعود', 'تقرت'] },
  { code: '31', name: 'وهران', communes: ['وهران', 'السانيا', 'بئر الجير', 'عين الترك'] },
  { code: '32', name: 'البيض', communes: ['البيض', 'براهيمي', 'بوقطب'] },
  { code: '33', name: 'إليزي', communes: ['إليزي', 'جانت', 'برج عمر إدريس'] },
  { code: '34', name: 'برج بوعريريج', communes: ['برج بوعريريج', 'رأس الوادي', 'المنصورة'] },
  { code: '35', name: 'بومرداس', communes: ['بومرداس', 'بودواو', 'برج منايل'] },
  { code: '36', name: 'الطارف', communes: ['الطارف', 'القالة', 'بوثلجة'] },
  { code: '37', name: 'تندوف', communes: ['تندوف', 'أم العسل'] },
  { code: '38', name: 'تيسمسيلت', communes: ['تيسمسيلت', 'برج بونعامة', 'ثنية الحد'] },
  { code: '39', name: 'الوادي', communes: ['الوادي', 'المغير', 'جامعة'] },
  { code: '40', name: 'خنشلة', communes: ['خنشلة', 'قايس', 'بابار'] },
  { code: '41', name: 'سوق أهراس', communes: ['سوق أهراس', 'سدراتة', 'مداوروش'] },
  { code: '42', name: 'تيبازة', communes: ['تيبازة', 'حجوط', 'شرشال'] },
  { code: '43', name: 'ميلة', communes: ['ميلة', 'فرجيوة', 'شلغوم العيد'] },
  { code: '44', name: 'عين الدفلى', communes: ['عين الدفلى', 'مليانة', 'الخميس'] },
  { code: '45', name: 'النعامة', communes: ['النعامة', 'مشرية', 'عين الصفراء'] },
  { code: '46', name: 'عين تموشنت', communes: ['عين تموشنت', 'حمام بوحجر', 'المالح'] },
  { code: '47', name: 'غرداية', communes: ['غرداية', 'متليلي', 'بريان'] },
  { code: '48', name: 'غليزان', communes: ['غليزان', 'وادي رهيو', 'مازونة'] },
  { code: '49', name: 'تيميمون', communes: ['تيميمون', 'أولاد سعيد', 'أوقروت'] },
  { code: '50', name: 'برج باجي مختار', communes: ['برج باجي مختار', 'تيمياوين'] },
  { code: '51', name: 'أولاد جلال', communes: ['أولاد جلال', 'سيدي خالد', 'الدوسن'] },
  { code: '52', name: 'بني عباس', communes: ['بني عباس', 'إقلي', 'تيمودي'] },
  { code: '53', name: 'إن صالح', communes: ['إن صالح', 'فقارة الزوى'] },
  { code: '54', name: 'إن قزام', communes: ['إن قزام', 'تين زاواتين'] },
  { code: '55', name: 'تقرت', communes: ['تقرت', 'المغير', 'الطيبات'] },
  { code: '56', name: 'جانت', communes: ['جانت', 'برج الحواس'] },
  { code: '57', name: 'المغير', communes: ['المغير', 'سطيل', 'أم الطيور'] },
  { code: '58', name: 'المنيعة', communes: ['المنيعة', 'حاسي الفحل'] },
];

// Well-known Algerian volleyball clubs (men's/women's Super Division and
// historically prominent teams) plus the two national selections.
export const ALGERIAN_VOLLEYBALL_TEAMS = [
  'المنتخب الوطني الجزائري (رجال)',
  'المنتخب الوطني الجزائري (سيدات)',
  'مجمع صيدال (GS Pétroliers)',
  'نادي شباب بجاية (NC Béjaïa)',
  'مولودية الجزائر (MC Alger)',
  'اتحاد الجزائر (USM Alger)',
  'مستقبل الرويبة (MC Rouiba)',
  'نجم عنابة (ES Sétif Volley)',
  'أولمبي أرزيو (Olympique Arzew)',
  'شباب الدار البيضاء',
  'وفاق سطيف',
  'مولودية بجاية',
  'اتحاد بلوزداد',
  'شباب باتنة',
  'أمل بوسعادة',
  'نادي وهران للكرة الطائرة',
  'شباب قسنطينة',
];

// Real per-club color identities used to render authentic, stylized SVG
// crest badges (see TeamCrest.jsx) instead of a single shared generic
// volleyball icon for every Algerian team. Colors reflect each club's
// actual/traditional kit colors; `initials` is the short mark shown on
// the badge itself. Matching is done by checking whether the team name
// stored on a match *contains* one of these keys (see
// getTeamCrestInfo below), so it keeps working whether the name is
// stored as e.g. "مولودية الجزائر" or "مولودية الجزائر (MC Alger)".
export const TEAM_CREST_STYLES = [
  { key: 'MC Alger', match: ['مولودية الجزائر', 'MC Alger'], initials: 'MCA', primary: '#c8102e', secondary: '#00843d' },
  { key: 'USM Alger', match: ['اتحاد الجزائر', 'USM Alger'], initials: 'USMA', primary: '#c8102e', secondary: '#0a0a0a' },
  { key: 'ES Sétif', match: ['نجم عنابة', 'ES Sétif', 'وفاق سطيف'], initials: 'ESS', primary: '#0a0a0a', secondary: '#ffffff' },
  { key: 'NC Béjaïa', match: ['شباب بجاية', 'مولودية بجاية', 'NC Béjaïa'], initials: 'NCB', primary: '#ffcc00', secondary: '#0033a0' },
  { key: 'GS Pétroliers', match: ['مجمع صيدال', 'GS Pétroliers', 'صيدال'], initials: 'GSP', primary: '#e2701a', secondary: '#0a0a0a' },
  { key: 'MC Rouiba', match: ['مستقبل الرويبة', 'MC Rouiba'], initials: 'MCR', primary: '#1e8a3c', secondary: '#ffffff' },
  { key: 'Olympique Arzew', match: ['أولمبي أرزيو', 'Olympique Arzew'], initials: 'OA', primary: '#0a3d8f', secondary: '#ffffff' },
  { key: 'USM Blida', match: ['اتحاد بلوزداد'], initials: 'USMB', primary: '#c8102e', secondary: '#ffffff' },
  { key: 'CSA Batna', match: ['شباب باتنة'], initials: 'CSAB', primary: '#0a3d8f', secondary: '#ffcc00' },
  { key: 'AB Bousaâda', match: ['أمل بوسعادة'], initials: 'ABB', primary: '#1e8a3c', secondary: '#c8102e' },
  { key: 'Oran VC', match: ['نادي وهران للكرة الطائرة'], initials: 'ORAN', primary: '#0a3d8f', secondary: '#ffcc00' },
  { key: 'CS Constantine', match: ['شباب قسنطينة'], initials: 'CSC', primary: '#00843d', secondary: '#ffffff' },
  { key: 'Chabab El Beida', match: ['شباب الدار البيضاء'], initials: 'CDB', primary: '#0a0a0a', secondary: '#c8102e' },
  {
    key: 'Algeria National Team',
    match: ['المنتخب الوطني الجزائري'],
    initials: 'DZ',
    primary: '#006233',
    secondary: '#ffffff',
    accent: '#d21034',
  },
];

// Resolves a team name to its authentic color identity for the crest
// badge, or null if the team isn't in the known-club list (in which
// case TeamCrest.jsx falls back to its generic ball emblem).
export function getTeamCrestInfo(name) {
  const clean = String(name || '');
  if (!clean) return null;
  return TEAM_CREST_STYLES.find((style) => style.match.some((token) => clean.includes(token))) || null;
}

// Categorized structure for "البطولة الجزائرية" (the Algerian
// Championship): each top-level division optionally splits into
// sub-groups (e.g. the two geographic pools used by the men's/women's
// national first divisions). A division with an empty `groups` array
// (e.g. the youth cup) has no sub-group filter.
export const ALGERIAN_DIVISIONS = [
  {
    id: 'nat1a-men',
    label: 'القسم الوطني الأول أ رجال',
    groups: [
      { id: 'center-east', label: 'مجموعة وسط شرق' },
      { id: 'center-west', label: 'مجموعة وسط غرب' },
    ],
  },
  {
    id: 'nat1b-men',
    label: 'القسم الوطني الأول ب رجال',
    groups: [
      { id: 'center-east', label: 'مجموعة وسط شرق' },
      { id: 'center-west', label: 'مجموعة وسط غرب' },
    ],
  },
  {
    id: 'nat1-women',
    label: 'القسم الوطني الأول سيدات',
    groups: [
      { id: 'center-east', label: 'مجموعة وسط شرق' },
      { id: 'center-west', label: 'مجموعة وسط غرب' },
    ],
  },
  {
    id: 'cup-elite',
    label: 'كأس الجزائر أكابر',
    // This division is intentionally the only one filtered by رجال/سيدات
    // instead of the وسط شرق/وسط غرب geographic split used everywhere
    // else — see spec.
    groups: [
      { id: 'men', label: 'رجال' },
      { id: 'women', label: 'سيدات' },
    ],
  },
  {
    id: 'cup-youth',
    label: 'كأس الجزائر للفئات الشبانية',
    groups: [
      { id: 'center-east', label: 'مجموعة وسط شرق' },
      { id: 'center-west', label: 'مجموعة وسط غرب' },
    ],
  },
];

// Deterministic string hash → HSL color, used to keep the same team
// crest color across sessions without needing any external image asset.
function hashToHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function getTeamCrestColor(name) {
  const hue = hashToHue(String(name || ''));
  return `hsl(${hue}, 65%, 45%)`;
}

// Short 1-3 letter initials shown inside the generated crest badge.
export function getTeamInitials(name) {
  const clean = String(name || '').replace(/\([^)]*\)/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '؟';
  if (words.length === 1) return words[0].slice(0, 2);
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}
