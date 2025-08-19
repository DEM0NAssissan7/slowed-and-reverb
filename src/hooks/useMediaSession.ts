import { useEffect } from "react";

export function useMediaSession(
  meta: { title: string; artist: string },
  elementRef: React.RefObject<HTMLAudioElement | undefined>
) {
  useEffect(() => {
    if (!elementRef) return;
    const element = elementRef.current;
    if (!meta.title || !element) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist,
    });
    navigator.mediaSession.setActionHandler("play", () => element.play());
    navigator.mediaSession.setActionHandler("pause", () => element.pause());

    const updateState = () => {
      navigator.mediaSession.playbackState = element.paused
        ? "paused"
        : "playing";
    };
    element.addEventListener("play", updateState);
    element.addEventListener("pause", updateState);
    updateState();

    return () => {
      element.removeEventListener("play", updateState);
      element.removeEventListener("pause", updateState);
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [meta.title, elementRef]);
}
