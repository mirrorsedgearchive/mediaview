import { useCallback, useEffect, useState } from 'react';

const useContextMenu = ({
  setSelectionMode,
  setSelectionEntries,
  discoverSelection,
  setDownloadPrompt,
  onNavigateToEntry,
  onShareEntry
}) => {
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    entry: null,
    type: 'entry'
  });

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false, entry: null }));
  }, []);

  const openContextMenu = useCallback((entry, position, menuType = 'entry') => {
    if (!entry && menuType !== 'selection') return;
    const menuWidth = 200;
    const menuHeight = menuType === 'selection' ? 104 : 220;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const x = Math.min(position.x, Math.max(0, viewportWidth - menuWidth));
    const y = Math.min(position.y, Math.max(0, viewportHeight - menuHeight));
    setContextMenu({
      open: true,
      x,
      y,
      entry: menuType === 'selection' ? null : entry,
      type: menuType
    });
  }, []);

  const handleContextSelect = useCallback(() => {
    if (!contextMenu.entry) return;
    setSelectionMode(true);
    setSelectionEntries([contextMenu.entry]);
    closeContextMenu();
  }, [closeContextMenu, contextMenu.entry, setSelectionEntries, setSelectionMode]);

  const handleContextDownload = useCallback(async () => {
    if (!contextMenu.entry) return;
    setSelectionMode(true);
    setSelectionEntries([contextMenu.entry]);
    closeContextMenu();
    const summary = await discoverSelection([contextMenu.entry]);
    if (summary) {
      setDownloadPrompt({ open: true, summary });
    }
  }, [
    closeContextMenu,
    contextMenu.entry,
    discoverSelection,
    setDownloadPrompt,
    setSelectionEntries,
    setSelectionMode
  ]);

  const handleContextCancelSelection = useCallback(() => {
    setSelectionMode(false);
    closeContextMenu();
  }, [closeContextMenu, setSelectionMode]);

  const handleContextGoToEntry = useCallback(() => {
    if (!contextMenu.entry) return;
    closeContextMenu();
    void onNavigateToEntry?.(contextMenu.entry);
  }, [closeContextMenu, contextMenu.entry, onNavigateToEntry]);

  const handleContextShare = useCallback(async () => {
    if (!contextMenu.entry) return;
    closeContextMenu();
    await onShareEntry?.(contextMenu.entry);
  }, [closeContextMenu, contextMenu.entry, onShareEntry]);

  useEffect(() => {
    if (!contextMenu.open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [closeContextMenu, contextMenu.open]);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleContextSelect,
    handleContextDownload,
    handleContextShare,
    handleContextCancelSelection,
    handleContextGoToEntry
  };
};

export { useContextMenu };
