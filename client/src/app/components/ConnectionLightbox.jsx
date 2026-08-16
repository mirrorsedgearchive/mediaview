import { Button, IconWifiOff, Modal } from './index.js';

const ConnectionLightbox = ({ open, onRetry }) => {
  if (!open) return null;
  return (
    <Modal
      className="connection-lightbox-card"
      backdropClassName="connection-lightbox"
      role="alertdialog"
      ariaLabel="Connection error"
    >
      <div className="connection-lightbox-icon" aria-hidden="true">
        <IconWifiOff />
      </div>
      <div className="connection-lightbox-title">Connection error</div>
      <div className="connection-lightbox-copy">
        We couldn&apos;t reach The Mirror&apos;s Edge Archive services. Check your connection and
        try again.
      </div>
      <div className="connection-lightbox-actions">
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </Modal>
  );
};

export default ConnectionLightbox;
