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

export const useDirectoryData = () => {
  const [directory, setDirectory] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [selected, setSelected] = useState(null);
  const [pendingSelection, setPendingSelection] = useState('');
  const search = useArchiveSearch();
  const [viewMode, setViewMode] = useState(() => {
    const stored = readStoredValue(viewModeKey);
    return stored === 'list' || stored === 'grid' ? stored : 'grid';
  });
  const [zoomLevel, setZoomLevel] = useState(() => {
    const stored = readStoredValue(zoomLevelKey);
    return stored === 'sm' || stored === 'md' || stored === 'lg' ? stored : 'md';
  });
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

  const loadDirectory = async (pathValue, options = {}) => {
    const { selectPath = '', openLightbox = true, force = false } = options;
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
    setStatus({ loading: true, error: null, retryable: false, code: null });
    setCurrentPath(pathValue);
    if (pathValue && treeHydratedRef.current) {
      expandAncestors(pathValue);
    }
    try {
      const listPromise = fetchList(pathValue, { force });
      if (pathValue) {
        void hydratePathChain(pathValue);
      }
      const data = await listPromise;
      applyListing(pathValue, data, { expand: true });
      const selection = getSelection(data.entries, selectPath);
      const shouldLightbox = openLightbox && Boolean(selectPath) && isViewableEntry(selection);
      if (pathValue) {
        setLastGoodPathValue(pathValue);
      }
      applyDirectoryState(data, pathValue, selection, selectPath, preserveSelection);
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
    },
  };
};
