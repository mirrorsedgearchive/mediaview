import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'mediaview:theme';
const WARN_LARGE_FILES_STORAGE_KEY = 'mediaview:warnLargeFiles';

const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'auto';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
  } catch {
    return 'auto';
  }
};

const getStoredWarnLargeFiles = () => {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(WARN_LARGE_FILES_STORAGE_KEY);
    return stored !== 'false';
  } catch {
    return true;
  }
};

const applyTheme = (value) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = value;
};

const useAppPreferences = () => {
  const [theme, setTheme] = useState(getStoredTheme);
  const [warnOnLargeFiles, setWarnOnLargeFiles] = useState(getStoredWarnLargeFiles);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window === 'undefined') return;
    try {
      if (theme === 'auto') {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    } catch {
      // Ignore storage write failures.
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(WARN_LARGE_FILES_STORAGE_KEY, String(warnOnLargeFiles));
    } catch {
      // Ignore storage write failures.
    }
  }, [warnOnLargeFiles]);

  return {
    theme,
    setTheme,
    warnOnLargeFiles,
    setWarnOnLargeFiles
  };
};

export { useAppPreferences };
