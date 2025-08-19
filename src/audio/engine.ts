import { audioBufferToWav, makeImpulseResponse } from "./helpers";

export namespace Engine {
  // Effects
  let playbackRate: number = 1.0;
  let reverbVolume: number = 0;
  let reverbLength: number = 0;

  // Engine internals
  let buffer: AudioBuffer;
  const ctx: AudioContext = new AudioContext();

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

  // Effect controls
  // Playback speed
  export function getPlaybackRate() {
    return playbackRate;
  }
  export function setPlaybackRate(speed: number) {
    playbackRate = speed;
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
