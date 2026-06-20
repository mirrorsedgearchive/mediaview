import { AppShell } from './AppShell.jsx';
import { useAppController } from './hooks/useAppController.js';

export default function App() {
  const controller = useAppController();

  return <AppShell {...controller} />;
}
