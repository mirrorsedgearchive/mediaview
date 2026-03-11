import { useCallback, useState } from 'react';

const useDownloadPrompt = ({ discoverSelection, downloadSelection }) => {
  const [downloadPrompt, setDownloadPrompt] = useState({
    open: false,
    summary: null
  });

  const handleRequestDownload = useCallback(async () => {
    const summary = await discoverSelection();
    if (summary) {
      setDownloadPrompt({ open: true, summary });
    }
  }, [discoverSelection]);

  const handleConfirmDownload = useCallback(() => {
    if (!downloadPrompt.summary) return;
    downloadSelection(null, downloadPrompt.summary);
    setDownloadPrompt({ open: false, summary: null });
  }, [downloadPrompt.summary, downloadSelection]);

  const handleCancelDownloadPrompt = useCallback(() => {
    setDownloadPrompt({ open: false, summary: null });
  }, []);

  return {
    downloadPrompt,
    setDownloadPrompt,
    handleRequestDownload,
    handleConfirmDownload,
    handleCancelDownloadPrompt
  };
};

export { useDownloadPrompt };
