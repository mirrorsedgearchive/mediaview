const SortButtons = ({ sortKey, sortDir, onSortClick }) => (
  <div className="panel-sort">
    <button
      type="button"
      className={`panel-sort-btn ${sortKey === 'name' ? `active dir-${sortDir}` : ''}`}
      onClick={() => onSortClick('name')}
    >
      <span>Name</span>
      <span className="sort-icon" aria-hidden="true">
        ▲
      </span>
    </button>
    <button
      type="button"
      className={`panel-sort-btn ${sortKey === 'size' ? `active dir-${sortDir}` : ''}`}
      onClick={() => onSortClick('size')}
    >
      <span>Size</span>
      <span className="sort-icon" aria-hidden="true">
        ▲
      </span>
    </button>
  </div>
);

export default SortButtons;
