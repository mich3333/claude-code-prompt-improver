import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { App } from './components/App.jsx';
import { player, store, timelineApi } from './state.js';
import { actions } from './actions.js';
import './styles.css';

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
