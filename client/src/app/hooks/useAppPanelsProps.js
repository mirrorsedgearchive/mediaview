import { useMemo } from 'react';

const useAppPanelsProps = ({
  layoutRef,
  treeData,
  searchQuery,
  currentPath,
  handleToggle,
  collapseAll,
  expandToCurrentPath,
  handleNavigate,
  treeStatus,
  retryTree,
  handleFooterOverlayClick
}) => useMemo(() => ({
  layoutRef,
  tree: treeData,
  treeCurrentPath: searchQuery ? null : currentPath,
  onToggleTree: handleToggle,
  onCollapseAll: collapseAll,
  onExpandCurrent: expandToCurrentPath,
  onNavigate: handleNavigate,
  treeStatus,
  onRetryTree: retryTree,
  onFooterOverlayClick: handleFooterOverlayClick
}), [
  collapseAll,
  currentPath,
  expandToCurrentPath,
  handleFooterOverlayClick,
  handleNavigate,
  handleToggle,
  layoutRef,
  retryTree,
  searchQuery,
  treeData,
  treeStatus
]);

export { useAppPanelsProps };
