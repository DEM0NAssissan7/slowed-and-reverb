import { audioBufferToWav, makeImpulseResponse } from "./helpers";

export namespace Engine {
  // Playback info
  let pausedAt: number = 0;
  let startedAt: number = 0;
  let isPlaying: boolean = false;

  // Effects
  let playbackRate: number = 1.0;
  let reverbVolume: number = 0;
  let reverbLength: number = 0;

  // Engine internals
  let buffer: AudioBuffer;
  let source: AudioBufferSourceNode;
  const ctx: AudioContext = new AudioContext();
  let manualEnd = false;

  // Nodes
  const outNode: GainNode = ctx.createGain();
  const wetNode: GainNode = ctx.createGain();
  const dryNode: GainNode = ctx.createGain();

  // Connect nodes
  outNode.connect(ctx.destination);
  wetNode.connect(outNode);
  dryNode.connect(outNode);

  // Convolver
  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  convolver.connect(wetNode);

  // Meta
  export async function load(file: File) {
    stop();
    const arr = await file.arrayBuffer();
    buffer = await ctx.decodeAudioData(arr);
  }
  function createBufferSource() {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = playbackRate;
    s.connect(dryNode);
    s.connect(convolver);
    s.onended = () => {
      if (!manualEnd) stop();
    };
    source = s;
  }

  // Getters
  export function getPosition() {
    if (!buffer) return 0;
    return isPlaying
      ? Math.max(
          0,
          Math.min(
            buffer.duration,
            (ctx.currentTime - startedAt) * playbackRate
          )
        )
      : pausedAt;
  }
  export function getDuration() {
    return buffer ? buffer.duration : 0;
  }
  export function getIsPlaying() {
    return isPlaying;
  }

  // Playback controls
  export async function play() {
    if (!buffer) return;
    if (isPlaying) return;

    await ctx.resume();

    createBufferSource();
    if (!source) return;

    const startOffset = Math.max(0, Math.min(buffer.duration, pausedAt));
    source.start(0, pausedAt);
    manualEnd = false;
    isPlaying = true;
    startedAt = ctx.currentTime - startOffset / playbackRate;
  }
  export function pause() {
    if (!buffer) return;
    manualEnd = true;
    pausedAt = getPosition();
    // Capture exact playhead with rate
    pausedAt = Math.max(
      0,
      Math.min(buffer.duration, (ctx.currentTime - startedAt) * playbackRate)
    );
    try {
      source?.stop();
    } catch {}
    isPlaying = false;
  }
  export function stop() {
    pause();
    pausedAt = 0;
  }
  export function seek(time: number) {
    if (!buffer) return;
    const target = Math.max(0, Math.min(buffer.duration, time));
    const wasPlaying = isPlaying;

    // If playing, stop & restart at target; else just store pausedAt
    pause();
    pausedAt = target;

    if (wasPlaying) {
      play();
    }
  }

  // Effect controls
  // Playback speed
  export function getPlaybackRate() {
    return playbackRate;
  }
  export function setPlaybackRate(speed: number) {
    playbackRate = speed;
    source?.playbackRate.setTargetAtTime(playbackRate, ctx.currentTime, 0.02);
  }
  // Reverb volume
  export function getReverbVolume() {
    return reverbVolume;
  }
  export function setReverbVolume(volume: number) {
    reverbVolume = volume;
    wetNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  }
  // Reverb size
  export function getReverbLength() {
    return reverbLength;
  }
  export function setReverbLength(seconds: number) {
    reverbLength = seconds;
    const ir = makeImpulseResponse(ctx, seconds, 2.8); // decay 2.8 by default
    convolver.buffer = ir;
  }

  // Extras
  export async function renderWav() {
    if (!source) return;
    const sampleRate = ctx.sampleRate;
    const outDuration = buffer.duration / playbackRate + reverbLength;
    const offlineCtx = new OfflineAudioContext(
      buffer.numberOfChannels,
      Math.ceil(outDuration * sampleRate),
      sampleRate
    );

    const dryNode = offlineCtx.createGain();
    const wetNode = offlineCtx.createGain();

    // Set gains
    wetNode.gain.value = reverbVolume;

    const convolver = offlineCtx.createConvolver();
    convolver.buffer = makeImpulseResponse(offlineCtx, reverbLength, 2.8);
    convolver.normalize = true;

    const src = offlineCtx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRate;

    src.connect(dryNode).connect(offlineCtx.destination);
    src.connect(convolver).connect(wetNode).connect(offlineCtx.destination);

    src.start(0);

    const rendered = await offlineCtx.startRendering();
    return audioBufferToWav(rendered);
  }
}
