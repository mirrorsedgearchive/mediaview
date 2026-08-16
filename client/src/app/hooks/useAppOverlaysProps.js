import { useCallback, useMemo } from 'react';

const useAppOverlaysProps = ({
  showConnectionLightbox,
  handleRetryConnection,
  lightboxOpen,
  selectedEntry,
  lightboxEntries,
  activeLightboxIndex,
  handleClose,
  handlePrev,
  handleNext,
  handleShareEntry,
  isTreeHidden,
  handleNavigateFromLightbox,
  warnOnLargeFiles,
  setWarnOnLargeFiles,
  settingsOpen,
  handleCloseSettings,
  theme,
  setTheme,
  snackbar,
  handleDismissSnackbar,
  contentWarning,
  confirmContentWarning,
  cancelContentWarning,
  clearAcceptedContentWarnings,
}) => {
  const handleDisableLargeFileWarnings = useCallback(() => {
    setWarnOnLargeFiles(false);
  }, [setWarnOnLargeFiles]);

  return useMemo(
    () => ({
      connectionLightboxProps: {
        open: showConnectionLightbox,
        onRetry: handleRetryConnection,
      },
      lightboxProps: {
        open: lightboxOpen,
        selectedEntry,
        lightboxEntries,
        activeIndex: activeLightboxIndex,
        onClose: handleClose,
        onPrev: handlePrev,
        onNext: handleNext,
        onShareEntry: handleShareEntry,
        showSideNav: !isTreeHidden,
        showPath: true,
        onNavigatePath: handleNavigateFromLightbox,
        warnOnLargeFiles,
        onDisableLargeFileWarnings: handleDisableLargeFileWarnings,
      },
      settingsModalProps: {
        open: settingsOpen,
        onClose: handleCloseSettings,
        theme,
        onThemeChange: setTheme,
        warnOnLargeFiles,
        onWarnOnLargeFilesChange: setWarnOnLargeFiles,
        onClearContentWarnings: clearAcceptedContentWarnings,
      },
      contentWarningModalProps: {
        warning: contentWarning,
        onShow: confirmContentWarning,
        onCancel: cancelContentWarning,
      },
      snackbarProps: {
        open: snackbar.open,
        message: snackbar.message,
        onClose: handleDismissSnackbar,
      },
    }),
    [
      activeLightboxIndex,
      cancelContentWarning,
      confirmContentWarning,
      contentWarning,
      clearAcceptedContentWarnings,
      handleClose,
      handleCloseSettings,
      handleDismissSnackbar,
      handleDisableLargeFileWarnings,
      handleNavigateFromLightbox,
      handleNext,
      handlePrev,
      handleRetryConnection,
      handleShareEntry,
      isTreeHidden,
      lightboxEntries,
      lightboxOpen,
      selectedEntry,
      setTheme,
      setWarnOnLargeFiles,
      settingsOpen,
      showConnectionLightbox,
      snackbar.message,
      snackbar.open,
      theme,
      warnOnLargeFiles,
    ]
  );
};

export { useAppOverlaysProps };
