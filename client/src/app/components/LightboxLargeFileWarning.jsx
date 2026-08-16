import { Button } from './index.js';

const LightboxLargeFileWarning = ({
  sizeLabel,
  disableWarningsChecked,
  onToggleDisableWarnings,
  onLoadFile,
  onClose,
}) => (
  <div className="lightbox-warning">
    <div className="lightbox-warning-title">Large file</div>
    <div className="lightbox-warning-copy">This file is {sizeLabel}. Loading may take a while.</div>
    <label className="lightbox-warning-checkbox">
      <input
        type="checkbox"
        checked={disableWarningsChecked}
        onChange={(event) => onToggleDisableWarnings(event.target.checked)}
        aria-label="Don't show this again for large files"
      />
      <span>Don&apos;t show this again for large files</span>
    </label>
    <div className="lightbox-warning-actions">
      <Button onClick={onLoadFile}>Load file</Button>
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  </div>
);

export default LightboxLargeFileWarning;
