import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../lib/api.js';
import { createRequestError, normalizeRequestError } from '../../lib/request.js';
import { getBasename } from '../../lib/format.js';

const initialTree = {
  '': { path: '', name: 'Archive', expanded: true, children: null },
};

export const useDirectoryTree = () => {
  const [tree, setTree] = useState(initialTree);
  const [treeStatus, setTreeStatus] = useState({ loading: true, error: null, retryable: false });
  const treeHydratedRef = useRef(false);
  const treePrefetchingRef = useRef(true);

  const applyTreeNodes = (nodes) => {
    if (!nodes) return;
    setTree((prev) => {
      const next = { ...prev };
      const entries = Object.values(nodes).filter(Boolean);
      const childIndex = new Map();

      entries.forEach((node) => {
        const parent = node.parent ?? '';
        if (!node.path || node.path === '') return;
        if (!childIndex.has(parent)) childIndex.set(parent, []);
        childIndex.get(parent).push(node.path);
      });

      entries.forEach((node) => {
        const prevNode = next[node.path];
        const children = childIndex.get(node.path) || [];
        children.sort((a, b) =>
          getBasename(a).localeCompare(getBasename(b), undefined, { sensitivity: 'base' })
        );
        next[node.path] = {
          path: node.path,
          name: node.name || prevNode?.name || (node.path ? getBasename(node.path) : 'Archive'),
          children,
          expanded: prevNode?.expanded ?? node.path === '',
        };
      });

      return next;
    });
  };

  const updateTreeWithEntries = (pathValue, entries, options = {}) => {
    const { expand = false } = options;
    setTree((prev) => {
      const next = { ...prev };
      const nodeName = pathValue ? getBasename(pathValue) : prev['']?.name || 'Archive';
      const children = entries.filter((entry) => entry.isDir).map((entry) => entry.path);
      next[pathValue] = {
        path: pathValue,
        name: nodeName,
        expanded: expand ? true : (next[pathValue]?.expanded ?? false),
        children,
      };
      entries
        .filter((entry) => entry.isDir)
        .forEach((entry) => {
          if (!next[entry.path]) {
            next[entry.path] = {
              path: entry.path,
              name: entry.name,
              expanded: false,
              children: null,
            };
          }
        });
      return next;
    });
  };

  const expandAncestors = (pathValue) => {
    setTree((prev) => {
      const next = { ...prev };
      const resolvedRootLabel = prev['']?.name || 'Archive';
      next[''] = { ...(next[''] || {}), path: '', name: resolvedRootLabel, expanded: true };
      if (!pathValue) return next;
      const segments = pathValue.split('/').filter(Boolean);
      let parentPath = '';
      segments.forEach((segment) => {
        const current = parentPath ? `${parentPath}/${segment}` : segment;
        const parentNode = next[parentPath] || {
          path: parentPath,
          name: parentPath ? getBasename(parentPath) : resolvedRootLabel,
          expanded: true,
          children: [],
        };
        const children = Array.isArray(parentNode.children) ? [...parentNode.children] : [];
        if (!children.includes(current)) {
          children.push(current);
        }
        next[parentPath] = { ...parentNode, children, expanded: true };
        next[current] = {
          ...(next[current] || {}),
          path: current,
          name: segment,
          expanded: true,
        };
        parentPath = current;
      });
      return next;
    });
  };

  const toggleNode = (pathValue) => {
    setTree((prev) => ({
      ...prev,
      [pathValue]: {
        ...prev[pathValue],
        expanded: !prev[pathValue]?.expanded,
      },
    }));
  };

  const collapseAll = () => {
    setTree((prev) => {
      const next = {};
      Object.values(prev).forEach((node) => {
        if (!node) return;
        const isRoot = node.path === '';
        next[node.path] = { ...node, expanded: isRoot };
      });
      return next;
    });
  };

  const fetchTree = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tree`);
      if (!response.ok) {
        throw createRequestError('Failed to load tree', response.status);
      }
      return response.json();
    } catch (error) {
      throw normalizeRequestError(error, 'Failed to load tree');
    }
  };

  const loadTree = async () => {
    setTreeStatus({ loading: true, error: null, retryable: false });
    treePrefetchingRef.current = true;
    try {
      const data = await fetchTree();
      applyTreeNodes(data?.nodes);
      treeHydratedRef.current = true;
      setTreeStatus({ loading: false, error: null, retryable: false });
    } catch (error) {
      const normalized = normalizeRequestError(error, 'Failed to load tree');
      setTreeStatus({
        loading: false,
        error: normalized.message,
        retryable: Boolean(normalized.retryable),
      });
    } finally {
      treePrefetchingRef.current = false;
    }
  };

  const loadTreeRef = useRef(loadTree);
  loadTreeRef.current = loadTree;

  useEffect(() => {
    loadTreeRef.current().catch(() => {});
    return undefined;
  }, []);

  return {
    tree,
    treeStatus,
    treeHydratedRef,
    treePrefetchingRef,
    updateTreeWithEntries,
    expandAncestors,
    toggleNode,
    collapseAll,
    retryTree: loadTree,
  };
};
