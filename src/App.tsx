import { useEffect, useRef, useState } from "react";
import { Engine } from "./audio/engine";
import { fmt } from "./helpers";
import { updatePlaybackState, updatePositionState } from "./audio/mediaSession";
import { useMediaSession } from "./hooks/useMediaSession";

export default function App() {
  const [ready, setReady] = useState(false);
  const [speed, setSpeed] = useState(1.0); // 1.00 = 100%
  const [reverbVolume, setReverbVolume] = useState(0.0); // 0..1
  const [reverbLength, setReverbLength] = useState(2.0); // seconds
  const [filename, setFilename] = useState("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Media Session
  function updateMediaSession() {
    updatePlaybackState();
    updatePositionState();
  }

  useMediaSession({ title: filename, artist: "slowed+reverb", album: "" });

  // UI ticker
  const raf = useRef<number>(0);
  useEffect(() => {
    if (isSeeking) return;
    const tick = () => {
      setPosition(Engine.getPosition());
      setDuration(Engine.getDuration());
      raf.current = requestAnimationFrame(tick);
      updateMediaSession();
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
    };
  }, [isSeeking, speed]);

  // Settings use effects
  useEffect(() => {
    Engine.setPlaybackRate(speed);
  }, [speed]);
  useEffect(() => {
    Engine.setReverbVolume(reverbVolume);
  }, [reverbVolume]);
  useEffect(() => {
    Engine.setReverbLength(reverbLength);
  }, [reverbLength]);

  async function onFile(file?: File) {
    if (!file) return;
    setFilename((file.name || "output").replace(/\.[^/.]+$/, ""));
    await Engine.load(file);
    setReady(true);
    updatePositionState();
  }
  async function download() {
    const blob = await Engine.renderWav();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-slowedandreverb.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function play() {
    await Engine.play();
    updateMediaSession();
    console.log("MediaSession supported:", !!navigator?.mediaSession);
  }
  function pause() {
    Engine.pause();
    updateMediaSession();
  }
  function stop() {
    Engine.stop();
    updateMediaSession();
  }
  const [wasPlaying, setWasPlaying] = useState(false);
  function beginSeek() {
    setWasPlaying(Engine.getIsPlaying());
    pause();
    setIsSeeking(true);
  }
  function seek() {
    console.log(`Seeking to ${position}`);
    requestAnimationFrame(() => {
      Engine.seek(position);
      setIsSeeking(false);
      if (wasPlaying) play();
    });
  }

  return (
    <>
      <div
        style={{
          maxWidth: 820,
          margin: "20px auto",
          padding: 16,
          color: "#e8ebf0",
          background: "#171a21",
          borderRadius: 12,
          border: "1px solid #2a2f3a",
        }}
      >
        <h2>Slowed + Reverb</h2>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={play} disabled={!ready}>
            Play
          </button>
          <button onClick={pause} disabled={!ready}>
            Pause
          </button>
          <button onClick={stop} disabled={!ready}>
            Stop
          </button>
          <button onClick={download} disabled={!ready}>
            Download
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={duration ? position : 0}
            onMouseDown={beginSeek}
            onMouseUp={seek}
            onChange={(e) => setPosition(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              opacity: 0.8,
            }}
          >
            <span>
              {fmt(position)} / {fmt(duration)}
            </span>
            <span>{Math.round(speed * 100)}%</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
            marginTop: 12,
          }}
        >
          <div>
            <div>Speed: {Math.round(speed * 100)}%</div>
            <input
              type="range"
              min={0.5}
              max={1.25}
              step={0.01}
              value={speed}
              onChange={(e) => {
                const a = parseFloat(e.target.value);
                setSpeed(a);
              }}
            />
            <div style={{ opacity: 0.8 }}>Pitch follows speed</div>
          </div>
          <div>
            <div>Reverb Mix: {Math.round(reverbVolume * 100)}%</div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={reverbVolume}
              onChange={(e) => {
                const a = parseFloat(e.target.value);
                setReverbVolume(a);
              }}
            />
          </div>
          <div>
            <div>Reverb Size: {reverbLength.toFixed(1)}s</div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.1}
              value={reverbLength}
              onChange={(e) => {
                const s = parseFloat(e.target.value);
                setReverbLength(s);
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
