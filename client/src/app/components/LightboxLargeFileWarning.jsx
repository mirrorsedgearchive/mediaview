const LightboxLargeFileWarning = ({
  sizeLabel,
  disableWarningsChecked,
  onToggleDisableWarnings,
  onLoadFile,
  onClose
}) => (
  <div className="lightbox-warning">
    <div className="lightbox-warning-title">Large file</div>
    <div className="lightbox-warning-copy">
      This file is {sizeLabel}. Loading may take a while.
    </div>
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
      <button
        type="button"
        className="lightbox-warning-button"
        onClick={onLoadFile}
      >
        Load file
      </button>
      <button
        type="button"
        className="lightbox-warning-button is-secondary"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  </div>
);

export default LightboxLargeFileWarning;
