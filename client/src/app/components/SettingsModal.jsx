import { useEffect, useRef, useState } from 'react';
import { Button, IconClose, Modal } from './index.js';

const SettingsModal = ({
  open,
  onClose,
  theme,
  onThemeChange,
  warnOnLargeFiles,
  onWarnOnLargeFilesChange,
  onClearContentWarnings,
}) => {
  const historyRef = useRef({ hasEntry: false, closingFromPop: false });
  const [contentWarningsCleared, setContentWarningsCleared] = useState(false);

  const handleClearContentWarnings = () => {
    onClearContentWarnings?.();
    setContentWarningsCleared(true);
  };

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const currentState = window.history.state || {};
    if (!currentState.settingsModal) {
      window.history.pushState({ ...currentState, settingsModal: true }, '');
    }
    historyRef.current.hasEntry = true;

    const handlePop = () => {
      historyRef.current.closingFromPop = true;
      historyRef.current.hasEntry = false;
      onClose?.();
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [onClose, open]);

  useEffect(() => {
    if (open || typeof window === 'undefined') return;
    if (!historyRef.current.hasEntry) {
      historyRef.current.closingFromPop = false;
      return;
    }
    if (historyRef.current.closingFromPop) {
      historyRef.current.closingFromPop = false;
      return;
    }
    historyRef.current.hasEntry = false;
    window.history.back();
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      className="settings-card"
      backdropClassName="settings-backdrop"
      onClose={onClose}
      ariaLabel="Settings"
    >
      <div className="settings-header">
        <div>
          <div className="settings-title">Settings</div>
          <div className="settings-subtitle">Preferences for this device</div>
        </div>
        <button
          type="button"
          className="settings-close"
          onClick={onClose}
          aria-label="Close settings"
        >
          <IconClose />
        </button>
      </div>
      <div className="settings-body">
        <div className="settings-row settings-row-select">
          <div className="settings-meta">
            <span className="settings-label">Theme</span>
            <span className="settings-hint">Follow your system unless overridden</span>
          </div>
          <div className="settings-control">
            <select
              value={theme}
              onChange={(event) => onThemeChange?.(event.target.value)}
              aria-label="Theme"
            >
              <option value="auto">Automatic</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
        <label className="settings-row">
          <span className="settings-meta">
            <span className="settings-label">Warn before loading large files</span>
            <span className="settings-hint">Show a confirmation before loading large previews</span>
          </span>
          <span className="settings-control">
            <input
              type="checkbox"
              checked={warnOnLargeFiles}
              onChange={(event) => onWarnOnLargeFilesChange?.(event.target.checked)}
              aria-label="Warn before loading large files"
            />
          </span>
        </label>
        <div className="settings-row">
          <span className="settings-meta">
            <span className="settings-label">Content warnings</span>
            <span className="settings-hint">Manage warnings you have already accepted</span>
          </span>
          <span className="settings-control">
            <Button
              variant="secondary"
              onClick={handleClearContentWarnings}
              disabled={contentWarningsCleared}
            >
              {contentWarningsCleared ? 'Cleared!' : 'Clear accepted warnings'}
            </Button>
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
