import React, { useState } from 'react';

// Renders a real country flag image (FlagCDN) when a URL is available,
// falling back to a neutral volleyball icon for club teams (no country
// match) or if the image fails to load — never guesses/misrepresents.
export default React.memo(function Flag({ url, alt = '' }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <span className="flag flag-fallback" role="img" aria-label={alt || 'volleyball'}>🏐</span>;
  }

  return (
    <img
      className="flag flag-img"
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
});
