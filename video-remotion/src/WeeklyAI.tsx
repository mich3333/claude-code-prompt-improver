import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { FPS, SCENES, type Pose } from './scenes';
import { SceneView, Waves } from './ui';

export type WeeklyProps = {
  /** Presenter image or video in public/ (e.g. "avatar.png"); null shows a placeholder. */
  avatar: string | null;
  /** Optional per-pose files in public/, e.g. { point: "poses/point.png" }. */
  poses: Partial<Record<Pose, string>>;
  /** Voice-over audio in public/, e.g. "voice.mp3". */
  voice: string | null;
  /** Show the narration text as captions (useful before the voice-over exists). */
  captions: boolean;
};

export const WeeklyAI: React.FC<WeeklyProps> = ({ avatar, poses, voice, captions }) => (
  <AbsoluteFill style={{ fontFamily: 'Rubik, sans-serif', direction: 'rtl' }}>
    <Waves />
    {SCENES.map((scene, i) => (
      <Sequence key={i} from={Math.round(scene.start * FPS)} durationInFrames={Math.round((scene.end - scene.start) * FPS)}>
        <SceneView scene={scene} avatar={avatar} poses={poses} captions={captions} />
      </Sequence>
    ))}
    {voice && <Audio src={staticFile(voice)} />}
  </AbsoluteFill>
);
