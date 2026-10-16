import '@fontsource/rubik/400.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import React from 'react';
import { Composition } from 'remotion';
import { DURATION, FPS } from './scenes';
import { H, W } from './ui';
import { WeeklyAI, type WeeklyProps } from './WeeklyAI';
import { estimateWords, SCRIPT_2026 } from './captions';
import { YEAR_DURATION, Year2026, type YearProps } from './Year2026';
import { NEWS_SCRIPT, NewsCast, type NewsProps } from './NewsCast';

const defaults: WeeklyProps = {
  avatar: null,
  poses: {},
  voice: null,
  captions: true,
};

// With a voice-over, the piece runs as long as the speech plus the title.
const yearMetadata = ({ props }: { props: YearProps }) => {
  const end = props.words?.length ? props.words[props.words.length - 1].end : 0;
  return { durationInFrames: Math.max(YEAR_DURATION, Math.ceil((end + 2.5) * FPS)) };
};

// The bulletin always runs as long as its words plus a short sign-off.
const newsMetadata = ({ props }: { props: NewsProps }) => {
  const end = props.words?.length ? props.words[props.words.length - 1].end : 10;
  return { durationInFrames: Math.ceil((end + 2) * FPS) };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="WeeklyAI"
      component={WeeklyAI}
      durationInFrames={DURATION}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={defaults}
    />
    <Composition
      id="AI2026"
      component={Year2026}
      durationInFrames={YEAR_DURATION}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ voice: null, words: null } as YearProps}
      calculateMetadata={yearMetadata}
    />
    {/* Same piece with captions timed from the script at a speaking pace, until a recording exists. */}
    <Composition
      id="AI2026Preview"
      component={Year2026}
      durationInFrames={YEAR_DURATION}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ voice: null, words: estimateWords(SCRIPT_2026) } as YearProps}
      calculateMetadata={yearMetadata}
    />
    <Composition
      id="NewsCast"
      component={NewsCast}
      durationInFrames={300}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ voice: null, words: null, anchor: null } as NewsProps}
      calculateMetadata={newsMetadata}
    />
    {/* The bulletin with the anchor talking to the script at an estimated pace, until a recording exists. */}
    <Composition
      id="NewsCastPreview"
      component={NewsCast}
      durationInFrames={300}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ voice: null, words: estimateWords(NEWS_SCRIPT.map((l) => l.text), { start: 1.2, pause: 0.6 }), anchor: null } as NewsProps}
      calculateMetadata={newsMetadata}
    />
  </>
);
