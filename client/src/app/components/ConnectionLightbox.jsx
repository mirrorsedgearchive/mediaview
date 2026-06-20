import { IconWifiOff } from './index.js';

const ConnectionLightbox = ({ open, onRetry }) => {
  if (!open) return null;
  return (
    <div className="connection-lightbox" role="alertdialog" aria-modal="true">
      <div className="connection-lightbox-card">
        <div className="connection-lightbox-icon" aria-hidden="true">
          <IconWifiOff />
        </div>
        <div className="connection-lightbox-title">Connection error</div>
        <div className="connection-lightbox-copy">
          We couldn&apos;t reach The Mirror&apos;s Edge Archive services. Check your connection and
          try again.
        </div>
        <div className="connection-lightbox-actions">
          <button type="button" className="connection-lightbox-button" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionLightbox;
