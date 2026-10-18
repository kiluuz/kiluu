export interface PlaybackClock {
  position: number;
  isPlaying: boolean;
  serverTs: number;
  playbackRate: number;
}

export function expectedPlaybackPosition(state: PlaybackClock, serverNow: number): number {
  if (!state.isPlaying) return Math.max(0, state.position);
  return Math.max(0, state.position + Math.max(0, serverNow - state.serverTs) / 1000 * state.playbackRate);
}

export function playbackCorrection(current: number, expected: number): { seekTo: number | null; rate: number } {
  const drift = expected - current;
  if (Math.abs(drift) > 0.5) return { seekTo: expected, rate: 1 };
  return { seekTo: null, rate: Math.max(0.95, Math.min(1.05, 1 + drift * 0.05)) };
}
