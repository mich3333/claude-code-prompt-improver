import '@fontsource/rubik/400.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import React from 'react';
import { Composition } from 'remotion';
import { DURATION, FPS } from './scenes';
import { H, W } from './ui';
import { WeeklyAI, type WeeklyProps } from './WeeklyAI';

const defaults: WeeklyProps = {
  avatar: null,
  poses: {},
  voice: null,
  captions: true,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="WeeklyAI"
    component={WeeklyAI}
    durationInFrames={DURATION}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={defaults}
  />
);
