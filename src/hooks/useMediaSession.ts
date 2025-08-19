import { useEffect } from "react";
import {
  type MediaMeta,
  type MediaSessionOptions,
  integrateWithOSMedia,
  updatePlaybackState,
  updatePositionState,
} from "../audio/mediaSession";

export function useMediaSession(
  meta: MediaMeta,
  options?: MediaSessionOptions
) {
  // Only import React types to avoid forcing React on non-React users
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useEffect(() => {
    if (!meta?.title) return;
    const dispose = integrateWithOSMedia(meta, options);
    // Push a quick state update on mount
    updatePlaybackState();
    updatePositionState();
    return () => dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.title, meta?.artist, meta?.album, JSON.stringify(meta?.artwork)]);
}
