import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { buildThumbUrl } from '../../lib/api.js';
import { formatSize } from '../../lib/format.js';
import { IconCheckCircleFill, iconForEntry } from './index.js';

const LIST_THUMB_SIZES = '32px';
const OVERSCAN_BY_ZOOM = {
  sm: 240,
  md: 420,
  lg: 640
};
const INITIAL_ITEMS_BY_ZOOM = {
  sm: 18,
  md: 24,
  lg: 30
};

const handleThumbLoad = (event) => {
  event.currentTarget.classList.add('loaded');
};

const buildThumbSrcSet = (pathValue) => ([
  `${buildThumbUrl(pathValue, 'sm')} 200w`,
  `${buildThumbUrl(pathValue, 'md')} 400w`,
  `${buildThumbUrl(pathValue, 'lg')} 600w`
].join(', '));

const ThumbStack = ({
  entry,
  sizes,
  wrapperClassName,
  imgClassName,
  iconClassName,
  iconTag: IconTag
}) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={wrapperClassName}>
      <img
        className={imgClassName}
        src={buildThumbUrl(entry.path, 'jpg')}
        srcSet={buildThumbSrcSet(entry.path)}
        alt=""
        sizes={sizes}
        loading='lazy'
        onLoad={handleThumbLoad}
        onError={(event) => {
          event.currentTarget.classList.add('thumb-failed');
          setHasError(true);
        }}
      />
      {hasError && (
        <IconTag className={iconClassName}>{iconForEntry(entry)}</IconTag>
      )}
    </div>
  );
};

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

const splitEntries = (entries) => {
  const folders = [];
  const files = [];
  entries.forEach((entry) => {
    if (entry.isDir) {
      folders.push(entry);
    } else {
      files.push(entry);
    }
  });
  return { folders, files };
};
const FileList = ({
  entries,
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
  zoomLevel
}) => {
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const gridRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const [gridReady, setGridReady] = useState(true);

  const normalizedEntries = useMemo(
    () => (Array.isArray(entries) ? entries : []),
    [entries]
  );
  const { folders, files } = useMemo(
    () => splitEntries(normalizedEntries),
    [normalizedEntries]
  );

  const selectedListIndex = selectedPath
    ? normalizedEntries.findIndex((entry) => entry.path === selectedPath)
    : -1;
  const selectedGridIndex = selectedPath
    ? files.findIndex((entry) => entry.path === selectedPath)
    : -1;

  useEffect(() => {
    if (viewMode !== 'grid') return;
    const target = useWindowScroll
      ? window
      : (scrollParent || containerRef.current);
    const element = useWindowScroll ? null : target;
    const hasSize = () => {
      if (useWindowScroll) {
        return window.innerWidth > 0 && window.innerHeight > 0;
      }
      return element && element.clientWidth > 0 && element.clientHeight > 0;
    };

    let frame = null;
    const ensureReady = () => {
      frame = null;
      setGridReady(hasSize());
      if (!hasSize()) {
        frame = requestAnimationFrame(ensureReady);
      }
    };

    frame = requestAnimationFrame(ensureReady);

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [viewMode, useWindowScroll, scrollParent]);

  useEffect(() => {
    if (viewMode !== 'grid') return undefined;
    if (useWindowScroll) {
      const handleResize = () => {
        setGridReady(window.innerWidth > 0 && window.innerHeight > 0);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const element = scrollParent || containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setGridReady(width > 0 && height > 0);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [viewMode, useWindowScroll, scrollParent]);

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


  const handleActivate = (entry) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(entry);
      return;
    }
    onSelect(entry);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openContextMenuAt = (entry, position) => {
    if (!onOpenContextMenu) return;
    if (selectionMode) {
      onOpenContextMenu(null, position, 'selection');
      return;
    }
    onOpenContextMenu(entry, position, 'entry');
  };

  const handlePointerDown = (entry, event) => {
    if (!onOpenContextMenu) return;
    if (event.pointerType === 'mouse') return;
    clearLongPress();
    longPressFiredRef.current = false;
    const { clientX, clientY } = event;
    longPressTimerRef.current = setTimeout(() => {
      openContextMenuAt(entry, { x: clientX, y: clientY });
      longPressFiredRef.current = true;
      clearLongPress();
    }, 500);
  };

  const handlePointerUp = () => {
    clearLongPress();
  };

  const handleContextMenu = (entry, event) => {
    if (!onOpenContextMenu) return;
    event.preventDefault();
    openContextMenuAt(entry, { x: event.clientX, y: event.clientY });
  };

  const handleClick = (entry) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    handleActivate(entry);
  };

  const overscanBy = OVERSCAN_BY_ZOOM[zoomLevel] || OVERSCAN_BY_ZOOM.md;
  const initialItemCount = INITIAL_ITEMS_BY_ZOOM[zoomLevel] || INITIAL_ITEMS_BY_ZOOM.md;
  const listKey = `${useWindowScroll ? 'window' : 'panel'}-${scrollParent ? 'ready' : 'wait'}-${normalizedEntries.length}`;

  if (viewMode === 'grid') {
    const gridComponents = { List: GridList };

    return (
      <div
        className={`grid-virtual${gridReady ? ' is-ready' : ''}`}
        ref={containerRef}
      >
        {folders.length > 0 && (
          <div className="grid grid-folder-section">
            {folders.map((entry) => {
              const isSelected = entry.path === selectedPath;
              const isBatchSelected = selectedPaths?.has(entry.path);
              const isContextHovered = contextMenuEntryPath === entry.path;
              return (
                <button
                  type="button"
                  key={entry.path}
                  data-path={entry.path}
                  className={`grid-card grid-folder-card ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''}${isContextHovered ? ' context-hovered' : ''}`}
                  onClick={() => handleClick(entry)}
                  onPointerDown={(event) => handlePointerDown(entry, event)}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onContextMenu={(event) => handleContextMenu(entry, event)}
                  aria-pressed={selectionMode ? isBatchSelected : undefined}
                >
                  <div className="grid-folder-thumb">
                    <div className="thumb-icon">{iconForEntry(entry)}</div>
                    {isBatchSelected && (
                      <div className="selection-overlay" aria-hidden="true">
                        <span className="selection-icon">
                          <IconCheckCircleFill />
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="grid-folder-label">
                    <span>{entry.name}</span>
                    <span className="grid-meta">Folder</span>
                  </div>
                </button>
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
            const hasPreview = entry.type === 'image' || entry.type === 'video';
            return (
              <button
                type="button"
                key={entry.path}
                data-path={entry.path}
                className={`grid-card ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''}${isContextHovered ? ' context-hovered' : ''}`}
                onClick={() => handleClick(entry)}
                onPointerDown={(event) => handlePointerDown(entry, event)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(event) => handleContextMenu(entry, event)}
                aria-pressed={selectionMode ? isBatchSelected : undefined}
              >
                <div className="thumb">
                  {hasPreview && (
                    <ThumbStack
                      entry={entry}
                      sizes="auto"
                      wrapperClassName="thumb-stack"
                      imgClassName={undefined}
                      iconClassName="thumb-icon"
                      iconTag="div"
                    />
                  )}
                  {!hasPreview && (
                    <div className="thumb-icon">{iconForEntry(entry)}</div>
                  )}
                  {isBatchSelected && (
                    <div className="selection-overlay" aria-hidden="true">
                      <span className="selection-icon">
                        <IconCheckCircleFill />
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid-label">
                  <span>{entry.name}</span>
                  <span className="grid-meta">{formatSize(entry.size)}</span>
                </div>
              </button>
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
    <div
      className={`list list-virtual list-zoom-${zoomLevel}`}
      ref={containerRef}
    >
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
          const hasPreview = entry.type === 'image' || entry.type === 'video';
          return (
            <button
              type="button"
              key={entry.path}
              data-path={entry.path}
              className={`list-row ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''} ${entry.isDir ? 'is-dir' : ''}${isContextHovered ? ' context-hovered' : ''}`}
              onClick={() => handleClick(entry)}
              onPointerDown={(event) => handlePointerDown(entry, event)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(event) => handleContextMenu(entry, event)}
              aria-pressed={selectionMode ? isBatchSelected : undefined}
            >
              <span className="list-cell name">
                <span className="list-icon">
                  {hasPreview && (
                    <ThumbStack
                      entry={entry}
                      sizes={LIST_THUMB_SIZES}
                      wrapperClassName="list-thumb-stack"
                      imgClassName="list-thumb"
                      iconClassName="list-thumb-icon"
                      iconTag="span"
                    />
                  )}
                  {!hasPreview && iconForEntry(entry)}
                  {isBatchSelected && (
                    <span className="selection-overlay" aria-hidden="true">
                      <span className="selection-icon">
                        <IconCheckCircleFill />
                      </span>
                    </span>
                  )}
                </span>
                {entry.name}
              </span>
              <span className="list-cell size">{formatSize(entry.size)}</span>
            </button>
          );
        }}
      />
    </div>
  );
};

export default FileList;
