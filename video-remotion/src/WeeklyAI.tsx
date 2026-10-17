import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { FPS, SCENES, type Pose } from './scenes';
import { Avatar, SceneView, Waves } from './ui';

export type WeeklyProps = {
  /**
   * Presenter in public/: an image (e.g. "avatar.png") or a talking-head video
   * (e.g. "avatar.mp4", made in HeyGen). null shows a placeholder.
   */
  avatar: string | null;
  /** Optional per-pose images in public/, e.g. { point: "poses/point.png" }, shown over the presenter in matching scenes. */
  poses: Partial<Record<Pose, string>>;
  /** Separate voice-over in public/, e.g. "voice.mp3". Without it, a video avatar's own sound is used. */
  voice: string | null;
  /** Show the narration text as captions. */
  captions: boolean;
};

const frames = (s: { start: number; end: number }) => ({
  from: Math.round(s.start * FPS),
  durationInFrames: Math.round((s.end - s.start) * FPS),
});

export const WeeklyAI: React.FC<WeeklyProps> = ({ avatar, poses, voice, captions }) => (
  <AbsoluteFill style={{ fontFamily: 'Rubik, sans-serif', direction: 'rtl' }}>
    <Waves />
    {SCENES.map((scene, i) => (
      <Sequence key={i} {...frames(scene)}>
        <SceneView scene={scene} captions={captions} />
      </Sequence>
    ))}
    <Avatar src={avatar} pose="talk" withAudio={!voice} />
    {SCENES.map((scene, i) =>
      poses[scene.pose] ? (
        <Sequence key={`pose-${i}`} {...frames(scene)}>
          <Avatar src={poses[scene.pose]!} pose={scene.pose} />
        </Sequence>
      ) : null,
    )}
    {voice && <Audio src={staticFile(voice)} />}
  </AbsoluteFill>
);
