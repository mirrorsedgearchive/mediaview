import { createContext, useContext } from 'react';

const ViewContext = createContext({
  viewMode: 'grid',
  setViewMode: () => {},
  zoomLevel: 'm',
  setZoomLevel: () => {},
});

const useViewContext = () => useContext(ViewContext);

export { ViewContext, useViewContext };
