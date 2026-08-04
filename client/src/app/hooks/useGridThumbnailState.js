import { useCallback, useEffect, useState } from 'react';

const DEFAULT_THUMBNAIL_SIZE = 'sm';
const thumbnailSizes = new Set(['sm', 'md', 'lg']);

const getThumbnailSize = (src) => {
  const segments = new URL(src).pathname.split('/');
  const thumbnailIndex = segments.indexOf('thumbnail');
  const size = segments[thumbnailIndex + 1];
  return thumbnailSizes.has(size) ? size : null;
};

export const useGridThumbnailState = ({
  containerRef,
  hasPreviewableFiles,
  scrollParent,
  useWindowScroll,
  viewMode,
  zoomLevel,
}) => {
  const [gridReady, setGridReady] = useState(true);
  const [thumbnailSize, setThumbnailSize] = useState(DEFAULT_THUMBNAIL_SIZE);

  const updateThumbnailSize = useCallback((src) => {
    const nextSize = getThumbnailSize(src);
    if (!nextSize) return;
    setThumbnailSize((previous) => (previous === nextSize ? previous : nextSize));
  }, []);

  useEffect(() => {
    if (viewMode !== 'grid') return undefined;

    const container = containerRef.current;
    const target = useWindowScroll ? null : scrollParent || container;
    if (!container) return undefined;

    let frame = null;
    const isReady = () => {
      if (useWindowScroll) return window.innerWidth > 0 && window.innerHeight > 0;
      return target && target.clientWidth > 0 && target.clientHeight > 0;
    };
    const update = () => {
      frame = null;
      const ready = isReady();
      setGridReady((previous) => (previous === ready ? previous : ready));
      if (!ready) {
        frame = requestAnimationFrame(update);
        return;
      }
      if (!hasPreviewableFiles) {
        setThumbnailSize(DEFAULT_THUMBNAIL_SIZE);
        return;
      }
      const image = container.querySelector('.thumb-stack img');
      if (image?.currentSrc) updateThumbnailSize(image.currentSrc);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    const handleLoad = (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches('.thumb-stack img')) return;
      updateThumbnailSize(image.currentSrc);
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);

    observer?.observe(container);
    if (target && target !== container) observer?.observe(target);
    window.addEventListener('resize', scheduleUpdate);
    container.addEventListener('load', handleLoad, true);
    scheduleUpdate();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      container.removeEventListener('load', handleLoad, true);
      observer?.disconnect();
    };
  }, [
    containerRef,
    hasPreviewableFiles,
    scrollParent,
    updateThumbnailSize,
    useWindowScroll,
    viewMode,
    zoomLevel,
  ]);

  return { gridReady, thumbnailSize };
};
