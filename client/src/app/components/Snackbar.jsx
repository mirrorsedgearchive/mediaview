import { useEffect } from 'react';

const Snackbar = ({ open, message, onClose, duration = 3200 }) => {
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const timer = window.setTimeout(() => {
      onClose();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose, open]);

  if (!open || !message) return null;

  return (
    <div className="snackbar" role="status" aria-live="polite">
      <span className="snackbar-message">{message}</span>
      <button
        type="button"
        className="snackbar-close"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        Close
      </button>
    </div>
  );
};

export default Snackbar;
