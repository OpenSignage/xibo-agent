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
 * Video History Management
 * 
 * This module manages the history of generated videos, including their metadata
 * and generation parameters. It reads from and writes to a persistent JSON file.
 */

import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../index';
import { config } from '../config';

// Defines the storage path for the history database.
const HISTORY_FILE = path.join(config.generatedDir, 'videoHistory.json');

// Ensures that the necessary directories for video storage and data exist.
if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
}

// Defines the schema for a single video history entry.
export const videoHistorySchema = z.object({
  id: z.string(),
  prompt: z.string(),
  negativePrompt: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]),
  status: z.enum(["pending", "completed", "failed"]),
  filePath: z.string().optional(),
  createdAt: z.string(),
  isFavorite: z.boolean().optional().default(false),
});

// Defines the schema for the entire video history, which is an array of entries.
export const historySchema = z.array(videoHistorySchema);

export type VideoHistory = z.infer<typeof videoHistorySchema>;
type History = z.infer<typeof historySchema>;

/**
 * Reads the video history from the JSON file.
 * If the file doesn't exist, it returns an empty array.
 * @returns {History} The parsed history data.
 */
export function readVideoHistory(): History {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(data) as unknown;
      return historySchema.parse(parsed);
    }
  } catch (error) {
    logger.error('Failed to load or parse video history file:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  return [];
}

/**
 * Writes the provided history data to the JSON file.
 * @param {History} history - The history data to save.
 */
export function writeVideoHistory(history: History): void {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    logger.error('Failed to save video history file:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Adds a new video entry to the history.
 * @param {Omit<VideoHistory, 'url'>} videoData - The data for the new video.
 * @returns {VideoHistory} The newly created video history entry.
 */
export function addVideoHistory(videoData: Omit<VideoHistory, 'filePath'> & { filePath?: string }): VideoHistory {
  const history = readVideoHistory();
  const newEntry: VideoHistory = {
    ...videoData,
  };
  history.unshift(newEntry);
  writeVideoHistory(history);
  return newEntry;
}

/**
 * Updates an existing video entry in the history.
 * @param {string} id - The ID of the video to update.
 * @param {Partial<Omit<VideoHistory, 'id'>>} updates - The fields to update.
 * @returns {VideoHistory | null} The updated video entry, or null if not found.
 */
export function updateVideoHistory(id: string, updates: Partial<Omit<VideoHistory, 'id'>>): VideoHistory | null {
  const history = readVideoHistory();
  const index = history.findIndex(v => v.id === id);
  if (index === -1) {
    logger.error(`Video with id ${id} not found for update.`);
    return null;
  }

  const updatedEntry = { ...history[index], ...updates };

  const validation = videoHistorySchema.safeParse(updatedEntry);
  if (!validation.success) {
    logger.error('Failed to validate updated video history entry:', { 
      id,
      errors: validation.error.format() 
    });
    return null;
  }
  
  history[index] = validation.data;
  writeVideoHistory(history);
  return validation.data;
} 