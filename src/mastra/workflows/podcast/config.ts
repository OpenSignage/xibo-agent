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
 * Centralized configuration for Podcast Planner defaults.
 *
 * This file defines the default parameters used by the podcast workflow so that
 * callers (agents, tools, or UI) do not need to pass many optional inputs.
 * Only a minimal set (e.g. report file name and caster names) needs to be
 * provided at runtime; everything else is derived from these defaults.
 */

export type LaughterMode = 'replace' | 'mute' | 'audio';

export interface PodcastDefaultsConfig {
  /** Default Google TTS voice name for Caster A (host). */
  voiceNameA: string;
  /** Default Google TTS voice name for Caster B (co-host/presenter). */
  voiceNameB: string;
  /** Default BCP-47 language code for TTS (e.g., 'ja-JP'). */
  languageCode: string;
  /** Default speaking rate (0.25–4.0). */
  speakingRate: number;
  /** Default pitch (-20.0 to 20.0). */
  pitch: number;
  /** Whether to insert opening BGM by default. */
  insertOpeningBgm: boolean;
  /** Whether to insert ending BGM by default. */
  insertEndingBgm: boolean;
  /** Whether to insert periodic jingles by default. */
  insertJingles: boolean;
  /** How to treat laughter markers like （笑）: replace/mute/audio. */
  laughterMode: LaughterMode;
  /** Default continuous BGM volume in decibels (applied when mixing with speech). */
  continuousBgmVolumeDb?: number;
  /** Whether to mix continuous background BGM by default. */
  insertContinuousBgm?: boolean;
}

/**
 * Default values consumed by `podcastPlanner.ts`.
 *
 * Adjust these to tune voices, language, delivery parameters, and whether to
 * include BGM/Jingles by default. Callers can still override these downstream
 * if needed, but most use-cases should not require passing these explicitly.
 */
export interface AudioAssetSet {
  /**
   * Opening BGM asset (WAV recommended).
   * You can specify either a plain filename (e.g., 'opening.wav'), which
   * will be resolved under 'persistent_data/assets/audios/', or a relative
   * path if you need a different subdirectory.
   */
  opening: string;
  /** Ending BGM asset (same resolution rules as 'opening'). */
  ending: string;
  /** Jingle asset (same resolution rules as 'opening'). */
  jingle: string;
  /** Optional continuous BGM (same resolution rules as 'opening'). */
  continuous?: string;
  /** Optional countdown SFX for Q&A thinking time (WAV recommended). */
  countdown?: string;
}

export const podcastConfig: { defaults: PodcastDefaultsConfig; assets: { podcast: AudioAssetSet; presentation: AudioAssetSet; quiz: AudioAssetSet } } = {
  defaults: {
    voiceNameA: 'ja-JP-Neural2-B',
    voiceNameB: 'ja-JP-Neural2-C',
    languageCode: 'ja-JP',
    speakingRate: 1.05,
    pitch: 0.0,
    insertOpeningBgm: true,
    insertEndingBgm: true,
    insertJingles: true,
    laughterMode: 'replace',
    continuousBgmVolumeDb: -20,
    insertContinuousBgm: true,
  },
  assets: {
    podcast: {
      opening: 'Broadcast News Short.wav',
      ending: 'Broadcast News Medium.wav',
      jingle: 'Electro Beep Accent 03.wav',
      continuous: 'bgm001.wav',
    },
    presentation: {
      opening: 'presentation.wav',
      ending: 'presentation_long.wav',
      jingle: 'jingle.wav',
      continuous: 'bgm002.wav',
    },
    quiz: {
      opening: 'Quiz opening.wav',
      ending: 'Quiz ending.wav',
      jingle: 'Electro Beep Accent 03.wav',
      continuous: 'bgm001.wav',
      countdown: 'countdown.wav',
    },
  },
};

