import {
  IconArrowsExpand,
  IconChevronRight,
  IconCollapse,
  IconDatabase,
  IconFolder,
} from './index.js';
const TreeNode = ({ node, tree, currentPath, onToggle, onNavigate, isRoot = false }) => {
  const rootLabel = 'Archive';
  const isLoaded = Array.isArray(node.children);
  const hasChildren = isLoaded && node.children.length > 0;
  const canExpand = !isLoaded || hasChildren;
  const isActive = node.path === currentPath;
  const displayName = isRoot ? rootLabel || node.name || 'Archive' : node.name || 'Archive';
  return (
    <div className={`tree-node ${isRoot ? 'root-node' : ''} ${isActive ? 'active' : ''}`}>
      <div className="tree-node-row">
        {!isRoot && canExpand ? (
          <button
            className={`tree-toggle ${node.expanded ? 'open' : ''}`}
            type="button"
            onClick={() => onToggle(node.path)}
            aria-label={node.expanded ? 'Collapse' : 'Expand'}
          >
            <span className="tree-toggle-icon" aria-hidden="true">
              <IconChevronRight />
            </span>
          </button>
        ) : isRoot ? null : (
          <span className="tree-toggle placeholder" aria-hidden="true" />
        )}
        <button className="tree-label" type="button" onClick={() => onNavigate(node.path)}>
          <span className="tree-icon">{isRoot ? <IconDatabase /> : <IconFolder />}</span>
          <span className="tree-name">{displayName}</span>
        </button>
      </div>
      {(isRoot || node.expanded) && hasChildren && (
        <div className="tree-children">
          {node.children.map((childPath) => {
            const childNode = tree[childPath];
            if (!childNode) return null;
            return (
              <TreeNode
                key={childPath}
                node={childNode}
                tree={tree}
                currentPath={currentPath}
                onToggle={onToggle}
                onNavigate={onNavigate}
                isRoot={false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const TreePanel = ({
  tree,
  currentPath,
  rootPath,
  onToggle,
  onNavigate,
  onCollapseAll,
  onExpandCurrent,
  hideHeader = false,
  status,
  onRetry,
}) => {
  const rootNode = tree[rootPath];
  const hasError = Boolean(status?.error);
  const isRetryable = Boolean(status?.retryable && onRetry);
  const canExpandCurrent = Boolean(currentPath);
  if (!rootNode) return null;
  return (
    <div className="panel tree-panel">
      <div className="panel-header">
        <div>{!hideHeader && <span className="panel-title">Folders</span>}</div>
        {!hideHeader && (
          <div className="tree-actions">
            <button
              type="button"
              className="tree-expand"
              onClick={onExpandCurrent}
              aria-label="Reveal current folder"
              title="Reveal current folder in the tree"
              disabled={!canExpandCurrent || !onExpandCurrent}
            >
              <IconArrowsExpand />
            </button>
            <button
              type="button"
              className="tree-collapse"
              onClick={onCollapseAll}
              aria-label="Collapse all folders"
              title="Collapse all folders"
            >
              <IconCollapse />
            </button>
          </div>
        )}
      </div>
      <div className="panel-body tree-scroll">
        {hasError && (
          <div className="state error">
            <div>{status.error}</div>
            {isRetryable && (
              <button type="button" className="state-cta" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}
        <TreeNode
          node={rootNode}
          tree={tree}
          currentPath={currentPath}
          onToggle={onToggle}
          onNavigate={onNavigate}
          isRoot
        />
      </div>
    </div>
  );
};

export default TreePanel;
