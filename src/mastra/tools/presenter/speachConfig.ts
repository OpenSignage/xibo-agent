/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the Elastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */
import { logger } from '../../logger';

/**
 * Voice parameters used for narration generation.
 */
export type SpeechConfig = {
  /** e.g., ja-JP-Neural2-B */
  voiceName?: string;
  /** e.g., ja-JP */
  languageCode?: string;
  /** 0.25 - 4.0 */
  speakingRate?: number;
  /** -20.0 - 20.0 */
  pitch?: number;
  /** Relative/absolute path to JSON for pronunciation overrides */
  pronunciationDictPath?: string;
};

/**
 * Load TTS configuration from environment with sensible JP defaults and apply overrides.
 * @param overrides optional overrides for environment-based defaults
 * @returns merged speech configuration
 */
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

/**
 * Get a recommended Japanese neural voice config by gender.
 * @param gender 'male'|'female'
 * @returns speech configuration with voice name and defaults
 */
export function getSpeechConfigByGender(gender: 'male'|'female'): SpeechConfig {
  // Known neural voices for Japanese (per Google TTS documentation)
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

