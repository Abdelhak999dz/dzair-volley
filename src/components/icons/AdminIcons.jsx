import React from 'react';

const base = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  xmlns: 'http://www.w3.org/2000/svg',
};

export function IconDashboard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

export function IconNews(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
      <path d="M6 7.5h8M6 10.5h8M6 13.5h5" />
    </svg>
  );
}

export function IconVideo(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M8.5 8l4 2-4 2V8Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMatch(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h8v3a4 4 0 0 1-8 0V3Z" />
      <path d="M6 4H3.5v1.2A2.8 2.8 0 0 0 6 8" />
      <path d="M14 4h2.5v1.2A2.8 2.8 0 0 1 14 8" />
      <path d="M10 10v3M7.5 16.5h5M8.5 13.3h3l.5 3.2h-4l.5-3.2Z" />
    </svg>
  );
}

export function IconImages(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
      <circle cx="7" cy="8.3" r="1.3" />
      <path d="M3 14.5l4.2-4a1.3 1.3 0 0 1 1.8 0L13 14.5" />
      <path d="M11.5 13l1.7-1.6a1.3 1.3 0 0 1 1.8 0l2.5 2.4" />
    </svg>
  );
}

export function IconEye(props) {
  return (
    <svg {...base} {...props}>
      <path d="M1.8 10S4.8 4.3 10 4.3 18.2 10 18.2 10 15.2 15.7 10 15.7 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

export function IconEyeOff(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 2.5l15 15" />
      <path d="M8.4 5.1A9.5 9.5 0 0 1 10 5c5.2 0 8.2 5.7 8.2 5.7a13.6 13.6 0 0 1-3 3.7M6 6.9C3.2 8.6 1.8 10.7 1.8 10.7S4.8 16.4 10 16.4c1.1 0 2.1-.2 3-.6" />
      <path d="M8.1 8.2A2.4 2.4 0 0 0 10 12.4c.5 0 1-.15 1.4-.4" />
    </svg>
  );
}

export function IconHeart(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 17s-6.5-4-8-8.2C1 5.7 2.7 3 5.6 3c1.7 0 3.2.9 4.4 2.5C11.2 3.9 12.7 3 14.4 3 17.3 3 19 5.7 18 8.8 16.5 13 10 17 10 17Z" />
    </svg>
  );
}

export function IconHeartFilled(props) {
  return (
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M10 17s-6.5-4-8-8.2C1 5.7 2.7 3 5.6 3c1.7 0 3.2.9 4.4 2.5C11.2 3.9 12.7 3 14.4 3 17.3 3 19 5.7 18 8.8 16.5 13 10 17 10 17Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconComment(props) {
  return (
    <svg {...base} {...props}>
      <path d="M17 10.5c0 3-3.1 5.5-7 5.5-1 0-2-.15-2.85-.43L3 17l.9-3.3C3.33 12.5 3 11.55 3 10.5 3 7.5 6.1 5 10 5s7 2.5 7 5.5Z" />
    </svg>
  );
}

export function IconShare(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="15" cy="4.5" r="2" />
      <circle cx="5" cy="10" r="2" />
      <circle cx="15" cy="15.5" r="2" />
      <path d="M6.7 8.9l6.6-3.3M6.7 11.1l6.6 3.3" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3.5H4.5A1.5 1.5 0 0 0 3 5v10a1.5 1.5 0 0 0 1.5 1.5H8" />
      <path d="M13 13.5l4-3.5-4-3.5" />
      <path d="M17 10H8" />
    </svg>
  );
}

export function IconArrowBack(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.5L5.5 10l6.5 5.5" />
      <path d="M6 10h9.5" />
    </svg>
  );
}

export function IconSettings(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v2.1M10 15.1v2.1M17.2 10h-2.1M4.9 10H2.8M15.1 4.9l-1.5 1.5M6.4 13.6l-1.5 1.5M15.1 15.1l-1.5-1.5M6.4 6.4L4.9 4.9" />
    </svg>
  );
}

export function IconEdit(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12.5 3.5l4 4L6 18H2v-4L12.5 3.5Z" />
      <path d="M10.5 5.5l4 4" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 5.5h13" />
      <path d="M7.5 5.5V4a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 12.5 4v1.5" />
      <path d="M5.5 5.5 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10.5" />
      <path d="M8.5 8.7v5M11.5 8.7v5" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 10.5l4 4 9-9" />
    </svg>
  );
}

export function IconX(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}
