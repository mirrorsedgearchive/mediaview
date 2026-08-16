import { Button, IconExclamationTriangle, Modal } from './index.js';

const ContentWarningModal = ({ warning, onShow, onCancel }) => {
  if (!warning) return null;

  return (
    <Modal
      className="download-modal"
      backdropClassName="download-modal-backdrop"
      onClose={onCancel}
      ariaLabelledBy="content-warning-title"
      ariaLabel="Content warning"
    >
      <div className="download-modal-header content-warning-header">
        <div className="content-warning-icon" aria-hidden="true">
          <IconExclamationTriangle />
        </div>
        <div>
          <div className="download-modal-title" id="content-warning-title">
            Content Warning
          </div>
          <div className="download-modal-sub">Not suitable for all audiences</div>
        </div>
      </div>
      <div className="download-modal-body">
        <div className="content-warning-copy">{warning.content}</div>
        <p className="content-warning-cta">Are you sure you want to proceed?</p>
      </div>
      <div className="download-modal-actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="secondary" onClick={onShow}>
          Show contents
        </Button>
      </div>
    </Modal>
  );
};

export default ContentWarningModal;
