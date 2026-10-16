import { Composition, registerRoot, Still } from 'remotion';
import { Cover } from './Cover.jsx';
import { KineticTitle } from './KineticTitle.jsx';
import { ListReveal } from './ListReveal.jsx';
import { WordCaptions } from './WordCaptions.jsx';
import { FPS, frames, heightFor, WIDTH } from './theme.js';

// Every clip's size and length come from its props: region (full | top) and
// duration (seconds), so one render call fits any scene.
const meta = ({ props }) => ({ durationInFrames: frames(props.duration ?? 4), height: heightFor(props.region) });

const captionsMeta = ({ props }) => {
  const last = (props.words ?? []).reduce((m, w) => Math.max(m, Number(w.end) || 0), 0);
  return { durationInFrames: frames(props.duration ?? last + (props.offset ?? 0) + 0.5) };
};

function Root() {
  return (
    <>
      <Composition id="KineticTitle" component={KineticTitle} fps={FPS} width={WIDTH} height={1920} durationInFrames={120}
        defaultProps={{ kicker: 'עובדה אחת', lines: ['זה משנה', 'את הכול'], highlight: ['הכול'], theme: 'gold', region: 'full', duration: 3 }}
        calculateMetadata={meta} />
      <Composition id="ListReveal" component={ListReveal} fps={FPS} width={WIDTH} height={1920} durationInFrames={120}
        defaultProps={{ title: '3 סיבות', items: ['זה מהיר יותר', 'זה זול יותר', 'זה עובד בעברית'], at: [], theme: 'gold', region: 'full', duration: 4 }}
        calculateMetadata={meta} />
      <Composition id="WordCaptions" component={WordCaptions} fps={FPS} width={WIDTH} height={1920} durationInFrames={90}
        defaultProps={{ words: [{ text: 'שלום', start: 0.2, end: 0.6 }, { text: 'לכולם', start: 0.65, end: 1.2 }], perPage: 3, y: 0.62, size: 92, offset: 0 }}
        calculateMetadata={captionsMeta} />
      <Still id="Cover" component={Cover} width={WIDTH} height={1920}
        defaultProps={{ image: '', title: 'ככה עושים רילס בדקה', highlight: ['בדקה'], subtitle: '', theme: 'gold' }} />
    </>
  );
}

registerRoot(Root);
