import { useCallback, useMemo, useState } from 'react';
import { isViewableEntry } from '../../lib/fileTypes.js';
import { getDirname } from '../../lib/format.js';
import { setUrlState } from '../../lib/urlState.js';

export const useLightboxState = ({
  entries,
  currentPath,
  isSearchMode,
  selected,
  setSelected,
  onNavigate,
  lightboxOpen: externalOpen,
  setLightboxOpen: externalSetOpen,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const lightboxOpen = externalOpen ?? internalOpen;
  const setLightboxOpen = externalSetOpen ?? setInternalOpen;

  const lightboxEntries = useMemo(() => entries.filter((entry) => !entry.isDir), [entries]);
  const selectedEntry = useMemo(() => {
    if (!selected) return null;
    return entries.some((entry) => entry.path === selected.path) ? selected : null;
  }, [entries, selected]);
  const activeLightboxIndex = useMemo(() => {
    if (!selectedEntry) return -1;
    return lightboxEntries.findIndex((entry) => entry.path === selectedEntry.path);
  }, [lightboxEntries, selectedEntry]);

  const handleViewMedia = useCallback(
    (entry) => {
      if (!isViewableEntry(entry)) return;
      if (!selected || selected.path !== entry.path) {
        setSelected(entry);
      }
      setLightboxOpen(true);
      if (!isSearchMode) {
        setUrlState({ path: currentPath, preview: entry.name }, { replace: true });
      }
    },
    [currentPath, isSearchMode, selected, setLightboxOpen, setSelected]
  );

  const handleOpen = useCallback(
    (entry) => {
      if (entry.isDir) {
        void onNavigate(entry.path);
        return;
      }
      if (isViewableEntry(entry)) {
        handleViewMedia(entry);
        return;
      }
      setSelected(entry);
      setLightboxOpen(true);
      if (!isSearchMode) {
        setUrlState({ path: currentPath, preview: entry.name }, { replace: true });
      }
    },
    [currentPath, handleViewMedia, isSearchMode, onNavigate, setLightboxOpen, setSelected]
  );

  const handleClose = useCallback(() => {
    setLightboxOpen(false);
    if (!isSearchMode) {
      setUrlState({ path: currentPath, preview: '' }, { replace: true });
    }
  }, [currentPath, isSearchMode, setLightboxOpen]);

  const openLightboxByIndex = useCallback(
    (index) => {
      if (index < 0 || index >= lightboxEntries.length) return;
      const entry = lightboxEntries[index];
      if (!entry) return;
      setSelected(entry);
      setLightboxOpen(true);
      if (!isSearchMode) {
        setUrlState({ path: currentPath, preview: entry.name }, { replace: true });
      }
    },
    [currentPath, isSearchMode, lightboxEntries, setLightboxOpen, setSelected]
  );

  const handlePrev = useCallback(() => {
    openLightboxByIndex(activeLightboxIndex - 1);
  }, [activeLightboxIndex, openLightboxByIndex]);

  const handleNext = useCallback(() => {
    openLightboxByIndex(activeLightboxIndex + 1);
  }, [activeLightboxIndex, openLightboxByIndex]);

  const handleNavigateFromLightbox = useCallback(
    (entry) => {
      if (!entry?.path) {
        setLightboxOpen(false);
        return Promise.resolve();
      }
      const targetDir = getDirname(entry.path);
      setLightboxOpen(false);
      return onNavigate(targetDir, { selectPath: entry.path, openLightbox: false });
    },
    [onNavigate, setLightboxOpen]
  );

  return {
    lightboxOpen,
    setLightboxOpen,
    selectedEntry,
    lightboxEntries,
    activeLightboxIndex,
    handleOpen,
    handleViewMedia,
    handleClose,
    handlePrev,
    handleNext,
    handleNavigateFromLightbox,
  };
};
