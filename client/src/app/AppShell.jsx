import {
  AppFooter,
  AppHeader,
  Breadcrumbs,
  ConnectionLightbox,
  DirectoryPanel,
  Lightbox,
  Snackbar,
  TreePanel
} from './components/index.js';
import {
  ContextMenuContext,
  DirectoryActionsContext,
  DirectoryDataContext,
  DownloadActionsContext,
  DownloadStateContext,
  SearchActionsContext,
  SearchStateContext,
  SelectionActionsContext,
  SelectionStateContext,
  ViewContext,
  useViewContext
} from './contexts/index.js';

const AppChrome = ({
  onNavigateRoot,
  searchQuery,
  searchHeaderRef,
  onSearchValueChange,
  onSearchSubmit,
  onSearchClear,
  onToggleFooter,
  showFooterToggle,
  footerOpen,
  breadcrumbsPath,
  onNavigate,
  isPathStale
}) => (
  <>
    <AppHeader
      onNavigateRoot={onNavigateRoot}
      searchQuery={searchQuery}
      ref={searchHeaderRef}
      onSearchValueChange={onSearchValueChange}
      onSearchSubmit={onSearchSubmit}
      onSearchClear={onSearchClear}
      onToggleFooter={onToggleFooter}
      showFooterToggle={showFooterToggle}
      footerOpen={footerOpen}
    />
    <div className="breadcrumbs-bar">
      <Breadcrumbs
        path={breadcrumbsPath}
        onNavigate={onNavigate}
        searchQuery={searchQuery}
        isPathStale={isPathStale}
      />
    </div>
  </>
);

const TreePanelContainer = ({
  tree,
  treeCurrentPath,
  onToggleTree,
  onCollapseAll,
  onExpandCurrent,
  onNavigate,
  treeStatus,
  onRetryTree
}) => (
  <TreePanel
    tree={tree}
    currentPath={treeCurrentPath}
    rootPath=""
    onToggle={onToggleTree}
    onCollapseAll={onCollapseAll}
    onExpandCurrent={onExpandCurrent}
    onNavigate={onNavigate}
    hideHeader={false}
    status={treeStatus}
    onRetry={onRetryTree}
  />
);

const AppPanels = ({
  layoutRef,
  tree,
  treeCurrentPath,
  onToggleTree,
  onCollapseAll,
  onExpandCurrent,
  onNavigate,
  treeStatus,
  onRetryTree,
  onFooterOverlayClick
}) => {
  const { zoomLevel } = useViewContext();
  return (
    <main className={`layout zoom-${zoomLevel}`} ref={layoutRef}>
      <TreePanelContainer
        tree={tree}
        treeCurrentPath={treeCurrentPath}
        onToggleTree={onToggleTree}
        onCollapseAll={onCollapseAll}
        onExpandCurrent={onExpandCurrent}
        onNavigate={onNavigate}
        treeStatus={treeStatus}
        onRetryTree={onRetryTree}
      />

      <DirectoryPanel />
      <div
        className="footer-scroll-guard"
        aria-hidden="true"
        onClick={onFooterOverlayClick}
      />
    </main>
  );
};

const FooterOverlay = ({ isTreeHidden, footerOpen, children }) => {
  if (isTreeHidden) return children;
  return (
    <div className={`footer-drawer${footerOpen ? ' is-open' : ''}`} aria-hidden={!footerOpen}>
      {children}
    </div>
  );
};

const AppProviders = ({
  directoryDataValue,
  directoryActionsValue,
  selectionStateValue,
  selectionActionsValue,
  downloadStateValue,
  downloadActionsValue,
  contextMenuValue,
  searchStateValue,
  searchActionsValue,
  children
}) => (
  <DirectoryDataContext.Provider value={directoryDataValue}>
    <DirectoryActionsContext.Provider value={directoryActionsValue}>
      <SelectionStateContext.Provider value={selectionStateValue}>
        <SelectionActionsContext.Provider value={selectionActionsValue}>
          <DownloadStateContext.Provider value={downloadStateValue}>
            <DownloadActionsContext.Provider value={downloadActionsValue}>
              <ContextMenuContext.Provider value={contextMenuValue}>
                <SearchStateContext.Provider value={searchStateValue}>
                  <SearchActionsContext.Provider value={searchActionsValue}>
                    {children}
                  </SearchActionsContext.Provider>
                </SearchStateContext.Provider>
              </ContextMenuContext.Provider>
            </DownloadActionsContext.Provider>
          </DownloadStateContext.Provider>
        </SelectionActionsContext.Provider>
      </SelectionStateContext.Provider>
    </DirectoryActionsContext.Provider>
  </DirectoryDataContext.Provider>
);

const AppOverlays = ({
  connectionLightboxProps,
  lightboxProps,
  snackbarProps
}) => (
  <>
    {connectionLightboxProps?.open && (
      <ConnectionLightbox {...connectionLightboxProps} />
    )}
    {lightboxProps?.open && (
      <Lightbox {...lightboxProps} />
    )}
    <Snackbar {...snackbarProps} />
  </>
);

const AppShell = ({
  viewValue,
  appChromeProps,
  providerValues,
  panelsProps,
  overlaysProps,
  isTreeHidden,
  footerOpen
}) => (
  <ViewContext.Provider value={viewValue}>
    <div className="page">
      <AppChrome {...appChromeProps} />

      <AppProviders {...providerValues}>
        <AppPanels {...panelsProps} />
      </AppProviders>

      <AppOverlays {...overlaysProps} />
      <FooterOverlay isTreeHidden={isTreeHidden} footerOpen={footerOpen}>
        <AppFooter />
      </FooterOverlay>
    </div>
  </ViewContext.Provider>
);

export { AppShell };
