import { useEffect, useRef } from 'react';
import { IconDatabase } from './index.js';

const Breadcrumbs = ({ path, onNavigate, searchQuery, isPathStale = false }) => {
  const scrollRef = useRef(null);
  const segments = path ? path.split('/') : [];
  const rootLabel = 'Archive';

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const updateFade = () => {
      const maxScroll = node.scrollWidth - node.clientWidth;
      const hasOverflow = maxScroll > 1;
      const atStart = node.scrollLeft <= 1;
      const atEnd = node.scrollLeft >= maxScroll - 1;
      node.classList.toggle('has-overflow', hasOverflow);
      node.classList.toggle('fade-left', hasOverflow && !atStart);
      node.classList.toggle('fade-right', hasOverflow && !atEnd);
    };
    node.scrollLeft = node.scrollWidth;
    updateFade();
    const handleResize = () => updateFade();
    const handleScroll = () => updateFade();
    window.addEventListener('resize', handleResize);
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      node.removeEventListener('scroll', handleScroll);
    };
  }, [path, searchQuery]);

  const isSearchActive = Boolean(searchQuery);
  const isRootCurrent = !path && !isSearchActive && !isPathStale;

  return (
    <div className="breadcrumbs-scroll" ref={scrollRef}>
      <div className="breadcrumbs">
        <button
          className={`crumb is-home ${isRootCurrent ? 'current' : ''}`}
          type="button"
          onClick={() => onNavigate('')}
          aria-label={rootLabel}
        >
          <IconDatabase />
          <span className="crumb-label">{rootLabel}</span>
        </button>
        {isSearchActive && (
          <span className="crumb-segment">
            <span className="crumb-separator">/</span>
            <span className="crumb current">Search for &quot;{searchQuery}&quot;</span>
          </span>
        )}
        {!isSearchActive &&
          segments.map((segment, index) => {
            const crumbPath = segments.slice(0, index + 1).join('/');
            const isCurrent = !isPathStale && index === segments.length - 1;
            return (
              <span className="crumb-segment" key={crumbPath}>
                <span className="crumb-separator">/</span>
                <button
                  className={`crumb ${isCurrent ? 'current' : ''}`}
                  type="button"
                  onClick={() => onNavigate(crumbPath)}
                >
                  {segment}
                </button>
              </span>
            );
          })}
      </div>
    </div>
  );
};

export default Breadcrumbs;
