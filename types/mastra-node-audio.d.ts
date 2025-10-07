declare module '@mastra/node-audio' {
  import { Readable } from 'stream';

  export interface MicrophoneStream extends Readable {}

  export function playAudio(audioData: Uint8Array | ArrayBuffer | Buffer): Promise<void> | void;

  export function getMicrophoneStream(): MicrophoneStream;
}


