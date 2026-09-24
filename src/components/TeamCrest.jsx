import React, { useState } from 'react';
import { getTeamCrestColor, getTeamInitials, getTeamCrestInfo, ALGERIAN_VOLLEYBALL_TEAMS } from '../data/algeriaData.js';
import { isAlgerianMatch } from '../services/algerianFilter.js';

// Official crest image for Algerian teams — drop your real artwork in
// public/dv.jpg (exact filename) and it swaps in everywhere this badge
// is used (Algerian Results & Matches cards, admin match form) with no
// code changes needed. This still takes top priority over the built-in
// stylized crests below, in case a site owner wants one shared image
// for every team.
const ALGERIAN_CREST_SRC = '/dv.jpg';

// An Algerian club or national team gets a real crest badge instead of
// the generic initials badge used for foreign/unknown teams.
function isAlgerianTeamName(name) {
  if (!name) return false;
  if (ALGERIAN_VOLLEYBALL_TEAMS.includes(name)) return true;
  return isAlgerianMatch({ teamA: name });
}

// Renders a distinctive shield-shaped crest using a team's real/
// traditional color identity (see algeriaData.js TEAM_CREST_STYLES),
// with the team's short initials on it — an authentic, per-team badge
// rather than one shared generic icon for every Algerian club.
function StylizedClubCrest({ name, size, info }) {
  const uid = React.useId ? React.useId().replace(/:/g, '') : `${name}-crest`;
  const gradId = `dv-crest-grad-${uid}`;
  const shineId = `dv-crest-shine-${uid}`;
  const s = size;
  const { primary, secondary, accent, initials } = info;

  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: s,
        height: s,
        flexShrink: 0,
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
      }}
    >
      <svg viewBox="0 0 64 72" width={s} height={s * (72 / 64)} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
          <radialGradient id={shineId} cx="35%" cy="25%" r="75%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
          </radialGradient>
        </defs>

        {/* shield-shaped crest body */}
        <path
          d="M32 2 L59 11 V33 C59 51 47 63 32 70 C17 63 5 51 5 33 V11 Z"
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2"
        />
        <path
          d="M32 2 L59 11 V33 C59 51 47 63 32 70 C17 63 5 51 5 33 V11 Z"
          fill={`url(#${shineId})`}
        />
        {/* inner border accent stripe */}
        <path
          d="M32 8 L53 15.5 V32.5 C53 47 43.5 57 32 63 C20.5 57 11 47 11 32.5 V15.5 Z"
          fill="none"
          stroke={accent || 'rgba(255,255,255,0.7)'}
          strokeWidth="1.6"
          opacity="0.85"
        />
        <text
          x="32"
          y="42"
          fontFamily="Arial, sans-serif"
          fontWeight="900"
          fontSize={initials.length > 3 ? 13 : 16}
          fill="#ffffff"
          textAnchor="middle"
          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 0.6 }}
        >
          {initials}
        </text>
      </svg>
    </span>
  );
}

// Renders the shared dv.jpg artwork (if present) as a circular crest.
// If the image is missing/fails to load, falls back to a per-team
// stylized crest when the team's color identity is known, or — as a
// last resort for an unrecognized Algerian team — the generic cyan →
// green → gold volleyball emblem, so a badge is never simply blank.
function AlgerianVolleyballEmblem({ name, size }) {
  const [imgFailed, setImgFailed] = useState(false);
  const uid = React.useId ? React.useId().replace(/:/g, '') : `${name}-badge`;
  const gradId = `dv-alg-grad-${uid}`;
  const shineId = `dv-alg-shine-${uid}`;
  const s = size;
  const crestInfo = getTeamCrestInfo(name);

  if (!imgFailed) {
    return (
      <span
        title={name}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: s,
          height: s,
          flexShrink: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1.5px solid rgba(255,255,255,0.5)',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
        }}
      >
        <img
          src={ALGERIAN_CREST_SRC}
          alt={name}
          width={s}
          height={s}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  if (crestInfo) {
    return <StylizedClubCrest name={name} size={s} info={crestInfo} />;
  }

  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: s,
        height: s,
        flexShrink: 0,
        borderRadius: '50%',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
      }}
    >
      <svg viewBox="0 0 64 64" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="50%" stopColor="#00c87a" />
            <stop offset="100%" stopColor="#ffc93c" />
          </linearGradient>
          <radialGradient id={shineId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
          </radialGradient>
        </defs>

        {/* ball body */}
        <circle cx="32" cy="32" r="29" fill={`url(#${gradId})`} />
        <circle cx="32" cy="32" r="29" fill={`url(#${shineId})`} />
        <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />

        {/* curved volleyball panel seams */}
        <path d="M32 3a29 29 0 0 1 25.1 14.5" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.92" />
        <path d="M5 24.5A29 29 0 0 0 13.5 57" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.92" />
        <path d="M22 60.4A29 29 0 0 0 55 49.5" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.92" />
        <path d="M32 3v58" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.35" />
      </svg>
    </span>
  );
}

// Renders a real, uploaded/selected crest image for a specific team —
// used when a match carries its own logoUrl (set by the admin via file
// upload or dropdown selection in AdminDashboard.jsx), so authentic
// per-team crests always take priority over any generated placeholder.
function CustomCrest({ name, size, logoUrl }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) return null;
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.5)',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
      }}
    >
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setImgFailed(true)}
      />
    </span>
  );
}

// Renders a small crest for a team name. Priority order:
//   1) an explicit logoUrl (a real crest the admin uploaded/selected for
//      this specific match, see AdminDashboard.jsx's Team A/B logo
//      fields) — this is a *true* per-team crest, not a shared generic.
//   2) the known Algerian teams' emblem/dv.jpg fallback.
//   3) every other team keeps the compact deterministic initials badge.
export default React.memo(function TeamCrest({ name, size = 44, logoUrl }) {
  if (!name) return null;
  const initials = getTeamInitials(name);

  if (logoUrl) {
    return <CustomCrest name={name} size={size} logoUrl={logoUrl} />;
  }

  if (isAlgerianTeamName(name)) {
    return <AlgerianVolleyballEmblem name={name} size={size} />;
  }

  const color = getTeamCrestColor(name);

  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: `linear-gradient(150deg, ${color}, rgba(5,11,26,0.85))`,
        border: '1px solid var(--border-color)',
        color: 'var(--white)',
        fontWeight: 900,
        fontSize: size * 0.34,
        boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      }}
    >
      {initials}
    </span>
  );
});
