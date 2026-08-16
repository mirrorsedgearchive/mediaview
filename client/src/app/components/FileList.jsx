import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { useGridThumbnailState } from '../hooks/useGridThumbnailState.js';
import { buildThumbUrl } from '../../lib/api.js';
import { formatSize } from '../../lib/format.js';
import { IconCheckCircleFill, iconForEntry } from './index.js';

const LIST_THUMB_SIZES = '32px';
const MAX_FOLDER_PREVIEWS = 4;
const OVERSCAN_BY_ZOOM = {
  sm: 240,
  md: 420,
  lg: 640,
};
const INITIAL_ITEMS_BY_ZOOM = {
  sm: 18,
  md: 24,
  lg: 30,
};

const handleThumbLoad = (event) => {
  event.currentTarget.classList.add('loaded');
};

const buildThumbSrcSet = (pathValue) =>
  [
    `${buildThumbUrl(pathValue, 'sm')} 200w`,
    `${buildThumbUrl(pathValue, 'md')} 400w`,
    `${buildThumbUrl(pathValue, 'lg')} 600w`,
  ].join(', ');

const isPreviewableEntry = (entry) => entry?.type === 'image' || entry?.type === 'video';

const ThumbStack = memo(
  ({ entry, sizes, wrapperClassName, imgClassName, iconClassName, iconTag: IconTag }) => {
    const [hasError, setHasError] = useState(false);

    return (
      <div className={wrapperClassName}>
        <img
          className={imgClassName}
          src={buildThumbUrl(entry.path, 'jpg')}
          srcSet={buildThumbSrcSet(entry.path)}
          alt=""
          sizes={sizes}
          loading="lazy"
          onLoad={handleThumbLoad}
          onError={(event) => {
            event.currentTarget.classList.add('thumb-failed');
            setHasError(true);
          }}
        />
        {hasError && <IconTag className={iconClassName}>{iconForEntry(entry)}</IconTag>}
      </div>
    );
  }
);

const GridList = forwardRef(({ style, children, className, ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    style={style}
    className={`grid grid-virtuoso-list ${className || ''}`.trim()}
  >
    {children}
  </div>
));

const ListScroller = forwardRef(({ style, children, className, ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    style={style}
    className={`list-body list-body-virtual ${className || ''}`.trim()}
  >
    {children}
  </div>
));

const ListContainer = forwardRef(({ className, ...props }, ref) => (
  <div {...props} ref={ref} className={`list-virtuoso-list ${className || ''}`.trim()} />
));

GridList.displayName = 'GridList';
ListScroller.displayName = 'ListScroller';
ListContainer.displayName = 'ListContainer';
ThumbStack.displayName = 'ThumbStack';

const FolderThumbStack = memo(({ entry, previewEntries, thumbnailSize = 'sm' }) => {
  const [failedPaths, setFailedPaths] = useState(new Set());
  const availablePreviews = previewEntries.filter((preview) => !failedPaths.has(preview.path));

  if (!availablePreviews.length) {
    return <div className="folder-thumb-icon">{iconForEntry(entry)}</div>;
  }

  return (
    <div className={`folder-thumb-stack count-${availablePreviews.length}`}>
      {availablePreviews.map((preview) => (
        <div className="folder-preview" key={preview.path}>
          <img
            src={buildThumbUrl(preview.path, thumbnailSize)}
            alt=""
            loading="lazy"
            onLoad={handleThumbLoad}
            onError={() => {
              setFailedPaths((previous) => new Set(previous).add(preview.path));
            }}
          />
        </div>
      ))}
    </div>
  );
});

FolderThumbStack.displayName = 'FolderThumbStack';

const splitEntries = (entries) => {
  const folders = [];
  const files = [];
  let hasPreviewableFiles = false;
  entries.forEach((entry) => {
    if (entry.isDir) {
      folders.push(entry);
    } else {
      files.push(entry);
      hasPreviewableFiles ||= isPreviewableEntry(entry);
    }
  });
  return { folders, files, hasPreviewableFiles };
};

const SelectionOverlay = memo(({ tag: Tag = 'div' }) => (
  <Tag className="selection-overlay" aria-hidden="true">
    <span className="selection-icon">
      <IconCheckCircleFill />
    </span>
  </Tag>
));

SelectionOverlay.displayName = 'SelectionOverlay';

const GridFolderCard = memo(
  ({
    entry,
    previewEntries,
    isSelected,
    isBatchSelected,
    isContextHovered,
    selectionMode,
    itemHandlers,
    thumbnailSize,
  }) => (
    <button
      type="button"
      data-path={entry.path}
      className={`grid-card grid-folder-card ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''}${isContextHovered ? ' context-hovered' : ''}`}
      onClick={itemHandlers.onClick}
      onPointerDown={itemHandlers.onPointerDown}
      onPointerUp={itemHandlers.onPointerUp}
      onPointerCancel={itemHandlers.onPointerUp}
      onContextMenu={itemHandlers.onContextMenu}
      aria-pressed={selectionMode ? isBatchSelected : undefined}
    >
      <div className="grid-folder-thumb">
        <FolderThumbStack
          key={`${entry.path}:${previewEntries.map((preview) => preview.path).join(':')}`}
          entry={entry}
          previewEntries={previewEntries}
          thumbnailSize={thumbnailSize}
        />
        {isBatchSelected && <SelectionOverlay />}
      </div>
      <div className="grid-folder-label">
        <span>{entry.name}</span>
        <span className="grid-meta">Folder</span>
      </div>
    </button>
  )
);

GridFolderCard.displayName = 'GridFolderCard';

const GridFileCard = memo(
  ({ entry, isSelected, isBatchSelected, isContextHovered, selectionMode, itemHandlers }) => {
    const hasPreview = isPreviewableEntry(entry);

    return (
      <button
        type="button"
        data-path={entry.path}
        className={`grid-card ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''}${isContextHovered ? ' context-hovered' : ''}`}
        onClick={itemHandlers.onClick}
        onPointerDown={itemHandlers.onPointerDown}
        onPointerUp={itemHandlers.onPointerUp}
        onPointerCancel={itemHandlers.onPointerUp}
        onContextMenu={itemHandlers.onContextMenu}
        aria-pressed={selectionMode ? isBatchSelected : undefined}
      >
        <div className="thumb">
          {hasPreview ? (
            <ThumbStack
              entry={entry}
              sizes="auto"
              wrapperClassName="thumb-stack"
              imgClassName={undefined}
              iconClassName="thumb-icon"
              iconTag="div"
            />
          ) : (
            <div className="thumb-icon">{iconForEntry(entry)}</div>
          )}
          {isBatchSelected && <SelectionOverlay />}
        </div>
        <div className="grid-label">
          <span>{entry.name}</span>
          <span className="grid-meta">{formatSize(entry.size)}</span>
        </div>
      </button>
    );
  }
);

GridFileCard.displayName = 'GridFileCard';

const ListEntryRow = memo(
  ({
    entry,
    previewEntries,
    isSelected,
    isBatchSelected,
    isContextHovered,
    selectionMode,
    itemHandlers,
  }) => {
    const hasPreview = isPreviewableEntry(entry);

    return (
      <button
        type="button"
        data-path={entry.path}
        className={`list-row ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''} ${entry.isDir ? 'is-dir' : ''}${isContextHovered ? ' context-hovered' : ''}`}
        onClick={itemHandlers.onClick}
        onPointerDown={itemHandlers.onPointerDown}
        onPointerUp={itemHandlers.onPointerUp}
        onPointerCancel={itemHandlers.onPointerUp}
        onContextMenu={itemHandlers.onContextMenu}
        aria-pressed={selectionMode ? isBatchSelected : undefined}
      >
        <span className="list-cell name">
          <span className="list-icon">
            {entry.isDir ? (
              <FolderThumbStack
                key={`${entry.path}:${previewEntries.map((preview) => preview.path).join(':')}`}
                entry={entry}
                previewEntries={previewEntries}
              />
            ) : hasPreview ? (
              <ThumbStack
                entry={entry}
                sizes={LIST_THUMB_SIZES}
                wrapperClassName="list-thumb-stack"
                imgClassName="list-thumb"
                iconClassName="list-thumb-icon"
                iconTag="span"
              />
            ) : (
              iconForEntry(entry)
            )}
            {isBatchSelected && <SelectionOverlay tag="span" />}
          </span>
          {entry.name}
        </span>
        <span className="list-cell size">{formatSize(entry.size)}</span>
      </button>
    );
  }
);

ListEntryRow.displayName = 'ListEntryRow';

const FileList = ({
  entries,
  folderChildren,
  folderCustomThumbnails,
  viewMode,
  onSelect,
  selectedPath,
  selectionMode,
  selectedPaths,
  onToggleSelection,
  onOpenContextMenu,
  contextMenuEntryPath,
  scrollParent,
  useWindowScroll,
  zoomLevel,
}) => {
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const gridRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const normalizedEntries = useMemo(() => (Array.isArray(entries) ? entries : []), [entries]);
  const entryByPath = useMemo(() => {
    const next = new Map();
    normalizedEntries.forEach((entry, index) => {
      if (!entry?.path) return;
      next.set(entry.path, { entry, index });
    });
    return next;
  }, [normalizedEntries]);
  const { folders, files, hasPreviewableFiles } = useMemo(
    () => splitEntries(normalizedEntries),
    [normalizedEntries]
  );
  const folderPreviewsByPath = useMemo(() => {
    const previews = new Map();
    folders.forEach((folder) => {
      const customThumbnails = folderCustomThumbnails?.[folder.path];
      const children = folderChildren?.[folder.path];
      previews.set(
        folder.path,
        Array.isArray(customThumbnails) && customThumbnails.length > 0
          ? customThumbnails
          : Array.isArray(children)
            ? children.filter(isPreviewableEntry).slice(0, MAX_FOLDER_PREVIEWS)
            : []
      );
    });
    return previews;
  }, [folderChildren, folderCustomThumbnails, folders]);
  const fileIndexByPath = useMemo(() => {
    const next = new Map();
    files.forEach((entry, index) => {
      if (!entry?.path) return;
      next.set(entry.path, index);
    });
    return next;
  }, [files]);

  const { gridReady, thumbnailSize: gridThumbnailSize } = useGridThumbnailState({
    containerRef,
    hasPreviewableFiles,
    scrollParent,
    useWindowScroll,
    viewMode,
    zoomLevel,
  });

  const selectedListIndex = selectedPath ? (entryByPath.get(selectedPath)?.index ?? -1) : -1;
  const selectedGridIndex = selectedPath ? (fileIndexByPath.get(selectedPath) ?? -1) : -1;

  useEffect(() => {
    if (viewMode !== 'list') return;
    if (selectedListIndex < 0) return;
    listRef.current?.scrollToIndex({ index: selectedListIndex, align: 'center' });
  }, [selectedListIndex, viewMode, normalizedEntries.length]);

  useEffect(() => {
    if (viewMode !== 'grid') return;
    if (!gridReady) return;
    if (selectedGridIndex < 0) return;
    const delays = [0, 120, 300];
    const timers = [];
    const runScroll = () => {
      gridRef.current?.scrollToIndex({ index: selectedGridIndex, align: 'center' });
    };
    delays.forEach((delay) => {
      const timer = setTimeout(() => {
        requestAnimationFrame(runScroll);
      }, delay);
      timers.push(timer);
    });
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [selectedGridIndex, viewMode, files.length, gridReady, scrollParent, useWindowScroll]);
  const handleActivate = useCallback(
    (entry) => {
      if (!entry) return;
      if (selectionMode && onToggleSelection) {
        onToggleSelection(entry);
        return;
      }
      onSelect(entry);
    },
    [onSelect, onToggleSelection, selectionMode]
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const openContextMenuAt = useCallback(
    (entry, position) => {
      if (!onOpenContextMenu) return;
      if (selectionMode) {
        onOpenContextMenu(null, position, 'selection');
        return;
      }
      onOpenContextMenu(entry, position, 'entry');
    },
    [onOpenContextMenu, selectionMode]
  );

  const getEntryFromElement = useCallback(
    (element) => {
      const pathValue = element?.dataset?.path;
      return pathValue ? entryByPath.get(pathValue)?.entry || null : null;
    },
    [entryByPath]
  );

  const handleItemPointerDown = useCallback(
    (event) => {
      if (!onOpenContextMenu) return;
      if (event.pointerType === 'mouse') return;
      const entry = getEntryFromElement(event.currentTarget);
      if (!entry && !selectionMode) return;
      clearLongPress();
      longPressFiredRef.current = false;
      const { clientX, clientY } = event;
      longPressTimerRef.current = setTimeout(() => {
        openContextMenuAt(entry, { x: clientX, y: clientY });
        longPressFiredRef.current = true;
        clearLongPress();
      }, 500);
    },
    [clearLongPress, getEntryFromElement, onOpenContextMenu, openContextMenuAt, selectionMode]
  );

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleItemContextMenu = useCallback(
    (event) => {
      if (!onOpenContextMenu) return;
      event.preventDefault();
      const entry = getEntryFromElement(event.currentTarget);
      if (!entry && !selectionMode) return;
      openContextMenuAt(entry, { x: event.clientX, y: event.clientY });
    },
    [getEntryFromElement, onOpenContextMenu, openContextMenuAt, selectionMode]
  );

  const handleItemClick = useCallback(
    (event) => {
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        return;
      }
      const entry = getEntryFromElement(event.currentTarget);
      handleActivate(entry);
    },
    [getEntryFromElement, handleActivate]
  );

  const itemHandlers = useMemo(
    () => ({
      onClick: handleItemClick,
      onPointerDown: handleItemPointerDown,
      onPointerUp: handlePointerUp,
      onContextMenu: handleItemContextMenu,
    }),
    [handleItemClick, handleItemContextMenu, handleItemPointerDown, handlePointerUp]
  );

  const overscanBy = OVERSCAN_BY_ZOOM[zoomLevel] || OVERSCAN_BY_ZOOM.md;
  const initialItemCount = INITIAL_ITEMS_BY_ZOOM[zoomLevel] || INITIAL_ITEMS_BY_ZOOM.md;
  const listKey = `${useWindowScroll ? 'window' : 'panel'}-${scrollParent ? 'ready' : 'wait'}-${normalizedEntries.length}`;

  if (viewMode === 'grid') {
    const gridComponents = { List: GridList };

    return (
      <div className={`grid-virtual${gridReady ? ' is-ready' : ''}`} ref={containerRef}>
        {folders.length > 0 && (
          <div className="grid grid-folder-section">
            {folders.map((entry) => {
              const isSelected = entry.path === selectedPath;
              const isBatchSelected = selectedPaths?.has(entry.path);
              const isContextHovered = contextMenuEntryPath === entry.path;
              return (
                <GridFolderCard
                  key={entry.path}
                  entry={entry}
                  previewEntries={folderPreviewsByPath.get(entry.path) || []}
                  isSelected={isSelected}
                  isBatchSelected={isBatchSelected}
                  isContextHovered={isContextHovered}
                  selectionMode={selectionMode}
                  itemHandlers={itemHandlers}
                  thumbnailSize={gridThumbnailSize}
                />
              );
            })}
          </div>
        )}
        {gridReady && files.length > 0 && (
          <VirtuosoGrid
            ref={gridRef}
            data={files}
            customScrollParent={useWindowScroll ? undefined : scrollParent || undefined}
            useWindowScroll={useWindowScroll}
            initialItemCount={Math.min(files.length, initialItemCount)}
            increaseViewportBy={overscanBy}
            computeItemKey={(index, item) => item.path || `grid-${index}`}
            components={gridComponents}
            itemClassName="virtuoso-grid-item"
            itemContent={(_, entry) => {
              const isSelected = entry.path === selectedPath;
              const isBatchSelected = selectedPaths?.has(entry.path);
              const isContextHovered = contextMenuEntryPath === entry.path;
              return (
                <GridFileCard
                  entry={entry}
                  isSelected={isSelected}
                  isBatchSelected={isBatchSelected}
                  isContextHovered={isContextHovered}
                  selectionMode={selectionMode}
                  itemHandlers={itemHandlers}
                />
              );
            }}
          />
        )}
      </div>
    );
  }

  const listComponents = useWindowScroll
    ? { List: ListContainer }
    : { Scroller: ListScroller, List: ListContainer };

  return (
    <div className={`list list-virtual list-zoom-${zoomLevel}`} ref={containerRef}>
      <div className="list-header">
        <span className="list-cell name">Name</span>
        <span className="list-cell size">Size</span>
      </div>
      <Virtuoso
        key={listKey}
        ref={listRef}
        data={normalizedEntries}
        customScrollParent={useWindowScroll ? undefined : scrollParent || undefined}
        useWindowScroll={useWindowScroll}
        initialItemCount={Math.min(normalizedEntries.length, initialItemCount)}
        increaseViewportBy={overscanBy}
        components={listComponents}
        itemContent={(_, entry) => {
          if (!entry) {
            return null;
          }
          const isSelected = entry.path === selectedPath;
          const isBatchSelected = selectedPaths?.has(entry.path);
          const isContextHovered = contextMenuEntryPath === entry.path;
          return (
            <ListEntryRow
              entry={entry}
              previewEntries={folderPreviewsByPath.get(entry.path) || []}
              isSelected={isSelected}
              isBatchSelected={isBatchSelected}
              isContextHovered={isContextHovered}
              selectionMode={selectionMode}
              itemHandlers={itemHandlers}
            />
          );
        }}
      />
    </div>
  );
};

export default FileList;
