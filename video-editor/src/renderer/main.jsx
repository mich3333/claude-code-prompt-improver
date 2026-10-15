import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { App } from './components/App.jsx';
import { player, store, timelineApi } from './state.js';
import { actions } from './actions.js';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import '@fontsource/frank-ruhl-libre/400.css';
import '@fontsource/frank-ruhl-libre/700.css';
import './styles.css';

// Redraw the preview once bundled fonts finish loading.
document.fonts.ready.then(() => player.requestDraw());
document.fonts.addEventListener('loadingdone', () => player.requestDraw());

// Expose for automated UI tests.
window.clipcraft = { store, player, actions, timeline: timelineApi };

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Honour the OS "reduce motion" setting: transforms are dropped, fades stay. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
