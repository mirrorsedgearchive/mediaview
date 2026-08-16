import { useEffect, useRef, useState } from 'react';
import { isViewableEntry } from '../../lib/fileTypes.js';
import { useDirectoryTree } from './useDirectoryTree.js';
import { useDirectoryCache } from './useDirectoryCache.js';
import { useArchiveSearch } from './useArchiveSearch.js';

const readStoredValue = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStoredValue = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures (private mode, blocked storage, etc.)
  }
};

const viewModeKey = 'mediaview:viewMode';
const zoomLevelKey = 'mediaview:zoomLevel';
const contentWarningsKey = 'mediaview:contentWarnings';

const normalizePath = (value) => (value || '').replace(/^\/+|\/+$/g, '');
const getParentPath = (value) => {
  const normalized = normalizePath(value);
  const separator = normalized.lastIndexOf('/');
  return separator === -1 ? '' : normalized.slice(0, separator);
};

export const useDirectoryData = () => {
  const [directory, setDirectory] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [selected, setSelected] = useState(null);
  const [pendingSelection, setPendingSelection] = useState('');
  const [contentWarning, setContentWarning] = useState(null);
  const pendingWarningRef = useRef(null);
  const search = useArchiveSearch();
  const [viewMode, setViewMode] = useState(() => {
    const stored = readStoredValue(viewModeKey);
    return stored === 'list' || stored === 'grid' ? stored : 'grid';
  });
  const [zoomLevel, setZoomLevel] = useState(() => {
    const stored = readStoredValue(zoomLevelKey);
    return stored === 'sm' || stored === 'md' || stored === 'lg' ? stored : 'md';
  });
  const [acknowledgedWarningPaths, setAcknowledgedWarningPaths] = useState(() => {
    const stored = readStoredValue(contentWarningsKey);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
    } catch {
      return [];
    }
  });
  const acknowledgedWarningPathsRef = useRef(acknowledgedWarningPaths);
  const [status, setStatus] = useState({
    loading: true,
    error: null,
    retryable: false,
    code: null,
  });
  const {
    tree,
    treeStatus,
    treeHydratedRef,
    treePrefetchingRef,
    updateTreeWithEntries,
    expandAncestors,
    toggleNode,
    collapseAll,
    retryTree,
  } = useDirectoryTree();
  const {
    applyListing,
    fetchList,
    getCachedListing,
    getLastResolvablePath,
    hydratePathChain,
    resolveLastGoodPath,
  } = useDirectoryCache({ updateTreeWithEntries });
  const currentPathRef = useRef('');
  const [lastGoodPath, setLastGoodPath] = useState('');
  const resolvePathRef = useRef(0);

  const setLastGoodPathValue = (value, options = {}) => {
    const { allowEmpty = false } = options;
    if (value || allowEmpty) {
      setLastGoodPath(value);
    }
  };

  const getSelection = (entries, selectPath) => {
    if (!selectPath) return null;
    return entries.find((entry) => entry.path === selectPath || entry.name === selectPath) || null;
  };

  const applyDirectoryState = (
    data,
    pathValue,
    selection,
    selectPath,
    preserveSelection = false
  ) => {
    setDirectory(data);
    setCurrentPath(pathValue);
    if (selection) {
      setSelected(selection);
      setPendingSelection('');
    } else if (!selectPath) {
      if (!preserveSelection) {
        setSelected(null);
      }
      setPendingSelection('');
    }
    expandAncestors(pathValue);
    setStatus({ loading: false, error: null, retryable: false, code: null });
  };

  const getWarningForPath = (data, pathValue) =>
    data?.contentWarnings?.[pathValue] || data?.contentWarning || null;

  const hasAcknowledgedWarning = (warning) =>
    warning &&
    acknowledgedWarningPathsRef.current.some(
      (pathValue) => normalizePath(pathValue) === normalizePath(warning.path)
    );

  const blockForContentWarning = (
    data,
    pathValue,
    selection,
    selectPath,
    preserveSelection,
    openLightbox,
    fromUrl
  ) => {
    const warning = getWarningForPath(data, pathValue);
    if (!warning || hasAcknowledgedWarning(warning)) return false;
    pendingWarningRef.current = {
      data,
      pathValue,
      selection,
      selectPath,
      preserveSelection,
      openLightbox,
      warning,
      previousPath: currentPathRef.current,
      previousDirectory: directory,
      previousSelected: selected,
      previousPendingSelection: pendingSelection,
      fromUrl,
    };
    setContentWarning(warning);
    setStatus({ loading: false, error: null, retryable: false, code: null });
    return true;
  };

  const loadDirectory = async (pathValue, options = {}) => {
    const { selectPath = '', openLightbox = true, force = false, fromUrl = false } = options;
    const preserveSelection = !selectPath && pathValue === currentPathRef.current;
    setPendingSelection(selectPath || '');
    if (selectPath) {
      setSelected({ path: selectPath });
    } else if (!preserveSelection) {
      setSelected(null);
    }
    const cached = getCachedListing(pathValue);
    if (!cached && pathValue && treeHydratedRef.current) {
      expandAncestors(pathValue);
    }
    if (cached && !force) {
      const selection = getSelection(cached.entries, selectPath);
      const shouldLightbox = openLightbox && Boolean(selectPath) && isViewableEntry(selection);
      if (
        blockForContentWarning(
          cached,
          pathValue,
          selection,
          selectPath,
          preserveSelection,
          openLightbox,
          fromUrl
        )
      ) {
        return { selection: null, shouldLightbox: false, blocked: true };
      }
      if (pathValue) {
        setLastGoodPathValue(pathValue);
      }
      applyDirectoryState(cached, pathValue, selection, selectPath, preserveSelection);
      if (cached.isPartial) {
        void loadChildren(pathValue, { silent: true });
      }
      prefetchMissingChildren(cached.entries);
      if (pathValue) {
        void hydratePathChain(pathValue);
      }
      return { selection, shouldLightbox };
    }
    setDirectory(null);
    setCurrentPath(pathValue);
    if (pathValue && treeHydratedRef.current) {
      expandAncestors(pathValue);
    }
    setStatus({ loading: true, error: null, retryable: false, code: null });
    try {
      const listPromise = fetchList(pathValue, { force });
      const data = await listPromise;
      const selection = getSelection(data.entries, selectPath);
      const shouldLightbox = openLightbox && Boolean(selectPath) && isViewableEntry(selection);
      if (
        blockForContentWarning(
          data,
          pathValue,
          selection,
          selectPath,
          preserveSelection,
          openLightbox,
          fromUrl
        )
      ) {
        return { selection: null, shouldLightbox: false, blocked: true };
      }
      applyListing(pathValue, data, { expand: true });
      if (pathValue) {
        setLastGoodPathValue(pathValue);
      }
      applyDirectoryState(data, pathValue, selection, selectPath, preserveSelection);
      if (pathValue) {
        void hydratePathChain(pathValue);
      }
      prefetchMissingChildren(data.entries);
      return { selection, shouldLightbox };
    } catch (error) {
      const fallbackPath = getLastResolvablePath(pathValue);
      setLastGoodPathValue(fallbackPath, { allowEmpty: true });
      resolvePathRef.current += 1;
      const requestId = resolvePathRef.current;
      void resolveLastGoodPath(pathValue, () => resolvePathRef.current === requestId).then(
        (lastSuccess) => {
          if (lastSuccess === null) return;
          setLastGoodPathValue(lastSuccess, { allowEmpty: true });
        }
      );
      setStatus({
        loading: false,
        error: error.message,
        retryable: Boolean(error.retryable),
        code: Number.isFinite(error?.status) ? error.status : null,
      });
      return { selection: null, shouldLightbox: false };
    }
  };

  const loadChildren = async (pathValue, options = {}) => {
    const { silent = false } = options;
    try {
      const data = await fetchList(pathValue, {
        background: true,
        onBackgroundUpdate: (activePath, listing) => {
          if (currentPathRef.current !== activePath) return;
          setDirectory(listing);
          setSelected((prev) =>
            prev && listing.entries.find((entry) => entry.path === prev.path) ? prev : null
          );
        },
      });
      applyListing(pathValue, data, { expand: false });
    } catch (error) {
      if (silent) return;
      setStatus({
        loading: false,
        error: error.message,
        retryable: Boolean(error.retryable),
        code: Number.isFinite(error?.status) ? error.status : null,
      });
    }
  };

  const prefetchMissingChildren = (entries) => {
    if (!Array.isArray(entries)) return;
    entries
      .filter((entry) => entry?.isDir)
      .map((entry) => entry.path)
      .filter((childPath) => childPath && !getCachedListing(childPath))
      .forEach((childPath) => {
        void loadChildren(childPath, { silent: true });
      });
  };

  const handleToggle = (pathValue) => {
    const node = tree[pathValue];
    if (!node) return;
    if (!node.expanded && Array.isArray(node.children)) {
      node.children
        .filter((childPath) => !getCachedListing(childPath))
        .forEach((childPath) => {
          void loadChildren(childPath, { silent: true });
        });
    }
    if (
      !node.expanded &&
      node.children === null &&
      !treeHydratedRef.current &&
      !treePrefetchingRef.current
    ) {
      loadChildren(pathValue);
    }
    toggleNode(pathValue);
  };

  const expandToCurrentPath = () => {
    expandAncestors(currentPathRef.current);
  };

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    writeStoredValue(viewModeKey, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStoredValue(zoomLevelKey, zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    acknowledgedWarningPathsRef.current = acknowledgedWarningPaths;
    writeStoredValue(contentWarningsKey, JSON.stringify(acknowledgedWarningPaths));
  }, [acknowledgedWarningPaths]);

  const confirmContentWarning = () => {
    const pending = pendingWarningRef.current;
    if (!pending) return null;
    const warningPath = pending.warning.path;
    const nextAcknowledgedPaths = acknowledgedWarningPathsRef.current.includes(warningPath)
      ? acknowledgedWarningPathsRef.current
      : [...acknowledgedWarningPathsRef.current, warningPath];
    acknowledgedWarningPathsRef.current = nextAcknowledgedPaths;
    setAcknowledgedWarningPaths(nextAcknowledgedPaths);
    pendingWarningRef.current = null;
    setContentWarning(null);
    applyDirectoryState(
      pending.data,
      pending.pathValue,
      pending.selection,
      pending.selectPath,
      pending.preserveSelection
    );
    prefetchMissingChildren(pending.data.entries);
    return {
      pathValue: pending.pathValue,
      selectPath: pending.selectPath,
      openLightbox: pending.openLightbox,
    };
  };

  const cancelContentWarning = () => {
    const pending = pendingWarningRef.current;
    pendingWarningRef.current = null;
    setContentWarning(null);
    if (pending?.previousPath !== undefined) {
      setCurrentPath(pending.previousPath);
    }
    if (pending?.previousDirectory !== undefined) {
      setDirectory(pending.previousDirectory);
    }
    setSelected(pending?.previousSelected || null);
    setPendingSelection(pending?.previousPendingSelection || '');
    setStatus({ loading: false, error: null, retryable: false, code: null });
    return pending?.fromUrl ? getParentPath(pending.warning.path) : null;
  };

  const clearAcceptedContentWarnings = () => {
    acknowledgedWarningPathsRef.current = [];
    setAcknowledgedWarningPaths([]);
  };

  return {
    directory,
    currentPath,
    lastGoodPath,
    status,
    selection: {
      selected,
      setSelected,
      pendingSelection,
    },
    tree: {
      data: tree,
      status: treeStatus,
      handleToggle,
      collapseAll,
      expandToCurrentPath,
      retryTree,
    },
    search,
    view: {
      mode: viewMode,
      setMode: setViewMode,
      zoom: zoomLevel,
      setZoom: setZoomLevel,
    },
    actions: {
      loadDirectory,
      contentWarning,
      confirmContentWarning,
      cancelContentWarning,
      clearAcceptedContentWarnings,
    },
  };
};
