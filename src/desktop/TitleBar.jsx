import { useEffect, useState } from 'react';

const bridge = typeof window !== 'undefined' ? window.printCure : undefined;
const controls = bridge?.windowControls;

export default function TitleBar({ label = 'PrintCure', showOwnerButton = false }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!controls) return undefined;
    let active = true;

    function sync() {
      controls
        .isMaximized()
        .then((value) => {
          if (active) setMaximized(Boolean(value));
        })
        .catch(() => {});
    }

    sync();
    window.addEventListener('resize', sync);
    return () => {
      active = false;
      window.removeEventListener('resize', sync);
    };
  }, []);

  if (!controls) return null;

  return (
    <div className="titlebar">
      <div className="titlebar-brand" onDoubleClick={controls.maximize}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3h9l5 5v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#fff" />
          <path d="M14 3v4a1 1 0 0 0 1 1h4z" fill="#cbd8ff" />
          <path
            d="M12 17.5c-.8-.7-4-3-4-5.3a2.6 2.6 0 0 1 4-2.1 2.6 2.6 0 0 1 4 2.1c0 2.3-3.2 4.6-4 5.3z"
            fill="#2f5fe0"
          />
        </svg>
        <span>{label}</span>
        {showOwnerButton && bridge?.openOwnerPanel && (
          <button
            type="button"
            className="titlebar-gear"
            aria-label="Owner panel"
            title="Owner panel"
            onClick={bridge.openOwnerPanel}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.98 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.62 15 1.7 1.7 0 0 0 3.06 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.98a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.62 1.7 1.7 0 0 0 10 3.06V3h4v.08A1.7 1.7 0 0 0 15.02 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.38 9c.13.62.66 1.04 1.56 1.04H21v4h-.08A1.7 1.7 0 0 0 19.4 15z" />
            </svg>
          </button>
        )}
      </div>

      <div className="titlebar-controls">
        <button type="button" aria-label="Minimize" title="Minimize" onClick={controls.minimize}>
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 9h10" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={controls.maximize}
        >
          {maximized ? (
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <rect x="4" y="6" width="8" height="8" rx="1" />
              <path d="M6 6V4.5A1.5 1.5 0 0 1 7.5 3h6A1.5 1.5 0 0 1 15 4.5v6A1.5 1.5 0 0 1 13.5 12H12" />
            </svg>
          ) : (
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <rect x="4.5" y="4.5" width="9" height="9" rx="1" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar-close"
          aria-label="Close"
          title="Close"
          onClick={controls.close}
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M5 5l8 8M13 5l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
