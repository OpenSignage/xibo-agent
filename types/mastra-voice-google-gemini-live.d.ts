declare module '@mastra/voice-google-gemini-live' {
  import { EventEmitter } from 'events';
  import { Readable } from 'stream';

  export interface SpeakerEvent {
    audio: Uint8Array | ArrayBuffer | Buffer;
  }

  export interface WritingEvent {
    text: string;
    role: 'user' | 'assistant' | string;
  }

  export interface VoiceConnection extends EventEmitter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    speak(text: string): Promise<void>;
    send(stream: Readable | Uint8Array | ArrayBuffer | Buffer): Promise<void>;
    on(event: 'speaker', listener: (event: SpeakerEvent) => void): this;
    on(event: 'writing', listener: (event: WritingEvent) => void): this;
  }

  export interface GeminiLiveVoiceOptions {
    apiKey?: string;
    model?: string;
    speaker?: string;
    debug?: boolean;
    vertexAI?: boolean;
    project?: string;
    location?: string;
    serviceAccountKeyFile?: string;
  }

  export class GeminiLiveVoice {
    constructor(options: GeminiLiveVoiceOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    speak(text: string): Promise<void>;
    send(stream: Readable | Uint8Array | ArrayBuffer | Buffer): Promise<void>;
    on(event: 'speaker', listener: (event: SpeakerEvent) => void): this;
    on(event: 'writing', listener: (event: WritingEvent) => void): this;
  }
}


