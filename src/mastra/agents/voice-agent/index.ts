/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * Voice Agent
 * 
 * This module provides a simple voice-enabled agent using Google Gemini Live.
 * It connects the voice session, streams microphone input, and plays
 * synthesized audio responses from the agent.
 */

import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { playAudio, getMicrophoneStream } from '@mastra/node-audio';
import { GeminiLiveVoice } from "@mastra/voice-google-gemini-live";
 
export const voiceAgent = new Agent({
  name: 'Voice Agent',
  instructions: 'You are a voice assistant that can help users with their tasks.',
  model: google('gemini-2.0-flash-exp'),
  voice: new GeminiLiveVoice({
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'gemini-2.0-flash-exp',
    speaker: 'Puck',
    debug: true,
  }) as any,
});

// Connect before using speak/send
await voiceAgent.voice.connect();

// Listen for agent audio responses
voiceAgent.voice.on('speaker', (audio: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playAudio(audio as any);
});

// Listen for text responses and transcriptions
voiceAgent.voice.on('writing', ({ text, role }: { text: string; role: string }) => {
  console.log(`${role}: ${text}`);
});

// Initiate the conversation
await voiceAgent.voice.speak('How can I help you today?');

// Send continuous audio from the microphone
const micStream = getMicrophoneStream();
await voiceAgent.voice.send(micStream);