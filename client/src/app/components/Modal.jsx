import FocusTrap from 'focus-trap-react';
import { useRef } from 'react';

const joinClasses = (...values) => values.filter(Boolean).join(' ');

const Modal = ({
  children,
  className,
  backdropClassName,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  role = 'dialog',
}) => {
  const modalRef = useRef(null);

  return (
    <>
      {onClose ? (
        <button
          type="button"
          className={joinClasses('app-modal-backdrop', 'is-interactive', backdropClassName)}
          onClick={onClose}
          aria-label={ariaLabel ? `Close ${ariaLabel.toLowerCase()}` : 'Close modal'}
          tabIndex={-1}
        />
      ) : (
        <div className={joinClasses('app-modal-backdrop', backdropClassName)} aria-hidden="true" />
      )}
      <FocusTrap
        focusTrapOptions={{
          initialFocus: () =>
            modalRef.current?.querySelector('[data-modal-primary]') || modalRef.current,
          fallbackFocus: () => modalRef.current,
          escapeDeactivates: false,
          clickOutsideDeactivates: (event) =>
            Boolean(onClose) && event.target?.classList?.contains('is-interactive'),
          returnFocusOnDeactivate: true,
        }}
      >
        <div
          ref={modalRef}
          className={joinClasses('app-modal', className)}
          role={role}
          aria-modal="true"
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !onClose) return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
        >
          {children}
        </div>
      </FocusTrap>
    </>
  );
};

export default Modal;
