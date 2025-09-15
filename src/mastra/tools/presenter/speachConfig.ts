/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 */
import { logger } from '../../logger';

export type SpeechConfig = {
  voiceName?: string;          // e.g., ja-JP-Neural2-B
  languageCode?: string;       // e.g., ja-JP
  speakingRate?: number;       // 0.25 - 4.0
  pitch?: number;              // -20.0 - 20.0
  pronunciationDictPath?: string; // relative to project root or absolute
};

// Load from env with sensible defaults for Japanese
export function getSpeechConfig(overrides?: Partial<SpeechConfig>): SpeechConfig {
  const cfg: SpeechConfig = {
    voiceName: process.env.GOOGLE_TTS_VOICE_NAME || 'ja-JP-Neural2-B',
    languageCode: process.env.GOOGLE_TTS_LANGUAGE_CODE || 'ja-JP',
    speakingRate: (() => {
      const v = Number(process.env.GOOGLE_TTS_SPEAKING_RATE);
      return Number.isFinite(v) && v > 0 ? v : 1.0;
    })(),
    pitch: (() => {
      const v = Number(process.env.GOOGLE_TTS_PITCH);
      return Number.isFinite(v) ? v : 0.0;
    })(),
    pronunciationDictPath: process.env.GOOGLE_TTS_PRONUNCIATION_DICT || undefined,
  };
  const out: SpeechConfig = { ...cfg, ...(overrides || {}) };
  try { logger.debug({ out }, 'Loaded speech config'); } catch {}
  return out;
}

export function getSpeechConfigByGender(gender: 'male'|'female'): SpeechConfig {
  // Known good neural voices for Japanese (corrected based on Google TTS documentation)
  const female = 'ja-JP-Neural2-B';  // Female voice
  const male = 'ja-JP-Neural2-C';    // Male voice
  const voiceName = gender === 'male' ? male : female;
  return {
    voiceName,
    languageCode: process.env.GOOGLE_TTS_LANGUAGE_CODE || 'ja-JP',
    speakingRate: (() => {
      const v = Number(process.env.GOOGLE_TTS_SPEAKING_RATE);
      return Number.isFinite(v) && v > 0 ? v : 1.0;
    })(),
    pitch: (() => {
      const v = Number(process.env.GOOGLE_TTS_PITCH);
      return Number.isFinite(v) ? v : 0.0;
    })(),
    pronunciationDictPath: process.env.GOOGLE_TTS_PRONUNCIATION_DICT || undefined,
  };
}

