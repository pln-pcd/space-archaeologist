declare module "zzfx" {
  export function zzfx(...parameters: number[]): AudioBufferSourceNode;
  export const ZZFX: { volume: number; sampleRate: number; audioContext: AudioContext; play: (...p: number[]) => AudioBufferSourceNode };
}
