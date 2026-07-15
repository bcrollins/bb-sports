/**
 * Honest media launch posture — never invent episodes or playable clips.
 */

export type MediaLaunchState = 'not_launched' | 'launched';

export type MediaSurfaceStatus = {
  surface: 'podcast' | 'video';
  state: MediaLaunchState;
  /** Reader-facing status line. */
  statusLabel: string;
  /** True only when a real feed/asset pipeline is approved. */
  hasPlayableContent: boolean;
};

/**
 * Soft-launch / pre-audio truth. Flip only after Brad-approved real episodes
 * and licensed storage exist — never on marketing copy alone.
 */
export function getPodcastStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): MediaSurfaceStatus {
  const launched = String(env.BBSPORTS_PODCAST_LIVE ?? '').trim().toLowerCase() === 'true';
  return {
    surface: 'podcast',
    state: launched ? 'launched' : 'not_launched',
    statusLabel: launched ? 'Episodes live' : 'Coming soon — no episodes published yet',
    hasPlayableContent: launched,
  };
}

export function getVideoStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): MediaSurfaceStatus {
  const launched = String(env.BBSPORTS_VIDEO_LIVE ?? '').trim().toLowerCase() === 'true';
  return {
    surface: 'video',
    state: launched ? 'launched' : 'not_launched',
    statusLabel: launched ? 'Clips live' : 'Coming soon — no clips published yet',
    hasPlayableContent: launched,
  };
}
