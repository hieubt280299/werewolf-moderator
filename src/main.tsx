import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts: no render-blocking third-party stylesheet, cached with the app for offline use.
// Each file declares unicode-range subsets, so only the glyphs a page uses are downloaded.
import '@fontsource-variable/oswald/wght.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import App from './App';
import { preloadPortraits } from './components/shared/RoleAvatar';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

preloadPortraits();
