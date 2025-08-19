// Utilities to integrate the Engine namespace with the OS media controls (Media Session API)

import { Engine } from "./engine"; // adjust path if needed

type Artwork = Array<{
  src: string;
  sizes?: string;
  type?: string;
}>;

export type MediaMeta = {
  title: string;
  artist?: string;
  album?: string;
  artwork?: Artwork;
};

export type MediaSessionOptions = {
  /**
   * Called when the OS requests "previous track".
   * If you don't support tracks, you can map this to a seek or leave undefined.
   */
  onPreviousTrack?: () => void;

  /**
   * Called when the OS requests "next track".
   * If you don't support tracks, you can map this to a seek or leave undefined.
   */
  onNextTrack?: () => void;

  /**
   * How often to sync position state with the OS (ms). Default 500ms.
   */
  positionSyncIntervalMs?: number;

  /**
   * Amount (seconds) for OS seek forward/backward actions. Default 10s.
   */
  defaultSeekStep?: number;

  /**
   * Provide a fallback artwork if none is given in metadata.
   */
  fallbackArtwork?: Artwork;

  /**
   * If true, attempts to resume AudioContext on first interaction
   * when a media action arrives and the context is suspended.
   * Default true.
   */
  autoResumeAudioContext?: boolean;
};

const DEFAULTS: Required<
  Pick<
    MediaSessionOptions,
    "positionSyncIntervalMs" | "defaultSeekStep" | "autoResumeAudioContext"
  >
> = {
  positionSyncIntervalMs: 500,
  defaultSeekStep: 10,
  autoResumeAudioContext: true,
};

function supportsMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

/**
 * Set OS-visible metadata (title, artist, album, artwork).
 */
export function setMediaMetadata(meta: MediaMeta, opts?: MediaSessionOptions) {
  if (!supportsMediaSession()) return;

  const artwork =
    meta.artwork && meta.artwork.length > 0
      ? meta.artwork
      : opts?.fallbackArtwork ?? [];

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist ?? "",
      album: meta.album ?? "",
      artwork,
    });
  } catch {
    // Ignore metadata errors (e.g., invalid artwork)
  }
}

/**
 * Update OS-visible playback state based on Engine state.
 */
export function updatePlaybackState() {
  if (!supportsMediaSession()) return;

  const playing = Engine.getIsPlaying();
  navigator.mediaSession.playbackState = playing ? "playing" : "paused";
}

/**
 * Push a fresh position state (duration, position, playbackRate) to the OS.
 */
export function updatePositionState() {
  if (!supportsMediaSession()) return;
  if (!("setPositionState" in navigator.mediaSession)) return;

  const duration = Engine.getDuration();
  // Duration 0 means no media loaded; avoid sending invalid states
  if (!Number.isFinite(duration) || duration <= 0) return;

  const position = clamp(Engine.getPosition(), 0, duration);
  const playbackRate = clamp(Engine.getPlaybackRate?.() ?? 1, 0.25, 4);

  try {
    navigator.mediaSession.setPositionState({
      duration,
      position,
      playbackRate,
    });
  } catch {
    // Some platforms may throw—ignore
  }
}

/**
 * Register OS action handlers (play, pause, stop, seek).
 * Returns a cleanup function that clears handlers and any intervals.
 */
export function registerMediaSessionHandlers(
  meta: MediaMeta,
  options?: MediaSessionOptions
): () => void {
  if (!supportsMediaSession()) {
    return () => {};
  }

  const opts = { ...DEFAULTS, ...options };

  // Set initial metadata and state
  setMediaMetadata(meta, opts);
  updatePlaybackState();
  updatePositionState();

  // Helper to (optionally) resume the AudioContext on action
  async function ensureAudioContext() {
    try {
      // @ts-ignore - ctx is internal to Engine; if exposed, you can replace with a getter
      const ctx: AudioContext | undefined = (Engine as any)?.ctx;
      if (!ctx) return;
      if (opts.autoResumeAudioContext && ctx.state === "suspended") {
        await ctx.resume();
      }
    } catch {
      // ignore
    }
  }

  // Core controls
  setActionHandler("play", async () => {
    await ensureAudioContext();
    Engine.play();
    updatePlaybackState();
    updatePositionState();
  });

  setActionHandler("pause", () => {
    Engine.pause();
    updatePlaybackState();
    updatePositionState();
  });

  setActionHandler("stop", () => {
    Engine.stop();
    updatePlaybackState();
    updatePositionState();
  });

  // Seeking controls
  setActionHandler("seekbackward", (details: MediaSessionActionDetails) => {
    const step = details.seekOffset ?? opts.defaultSeekStep;
    const target = Engine.getPosition() - step;
    Engine.seek(target);
    updatePositionState();
  });

  setActionHandler("seekforward", (details: MediaSessionActionDetails) => {
    const step = details.seekOffset ?? opts.defaultSeekStep;
    const target = Engine.getPosition() + step;
    Engine.seek(target);
    updatePositionState();
  });

  setActionHandler("seekto", (details: MediaSessionActionDetails) => {
    if (typeof details.seekTime === "number") {
      Engine.seek(details.seekTime);
      updatePositionState();
    }
  });

  // Optional track navigation
  if (opts.onPreviousTrack) {
    setActionHandler("previoustrack", () => {
      opts.onPreviousTrack?.();
      updatePlaybackState();
      updatePositionState();
    });
  } else {
    // Clear if previously set
    setActionHandler("previoustrack", null);
  }

  if (opts.onNextTrack) {
    setActionHandler("nexttrack", () => {
      opts.onNextTrack?.();
      updatePlaybackState();
      updatePositionState();
    });
  } else {
    setActionHandler("nexttrack", null);
  }

  // Keep OS position/rate fresh while playing
  const interval = window.setInterval(() => {
    updatePlaybackState();
    updatePositionState();
  }, opts.positionSyncIntervalMs);

  // Cleanup: clear handlers and interval
  return () => {
    window.clearInterval(interval);
    // There is no official "unset" API; setting to null detaches in most UAs.
    setActionHandler("play", null);
    setActionHandler("pause", null);
    setActionHandler("stop", null);
    setActionHandler("seekbackward", null);
    setActionHandler("seekforward", null);
    setActionHandler("seekto", null);
    setActionHandler("previoustrack", null);
    setActionHandler("nexttrack", null);
  };
}

/**
 * Convenience: fully initialize Media Session for the current Engine buffer.
 * Returns a cleanup function.
 */
export function integrateWithOSMedia(
  meta: MediaMeta,
  options?: MediaSessionOptions
): () => void {
  const cleanup = registerMediaSessionHandlers(meta, options);

  // Optional: listen to visibility changes to keep state tidy
  const onVis = () => {
    // Refresh state when returning to tab
    if (!document.hidden) {
      updatePlaybackState();
      updatePositionState();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    cleanup();
    document.removeEventListener("visibilitychange", onVis);
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type Handler =
  | MediaSessionActionHandler
  | ((details: any) => void)
  | null
  | undefined;

function setActionHandler(action: MediaSessionAction, handler: Handler) {
  if (!supportsMediaSession()) return;

  try {
    // Some browsers (older Safari) may not support certain actions; guard calls.
    navigator.mediaSession.setActionHandler(action, handler as any);
  } catch {
    // ignore unsupported action errors
  }
}
