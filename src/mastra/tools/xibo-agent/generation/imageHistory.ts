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
 * Image History Management
 * 
 * This module manages the history of generated images, including their metadata
 * and generation parameters. It supports multiple concurrent generation processes
 * and maintains separate histories for each process.
 */

import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../index';

// 画像履歴のスキーマ定義
const imageHistorySchema = z.object({
  id: z.number(),
  filename: z.string(),
  prompt: z.string(),
  aspectRatio: z.string(),
  width: z.number(),
  height: z.number(),
  createdAt: z.string(),
});

// 生成プロセスのスキーマ定義
const generatorSchema = z.object({
  images: z.array(imageHistorySchema),
});

// 履歴データのスキーマ定義
const historySchema = z.record(z.string(), generatorSchema);

type ImageHistory = z.infer<typeof imageHistorySchema>;
type Generator = z.infer<typeof generatorSchema>;
type History = z.infer<typeof historySchema>;

// 履歴ファイルのパス
const HISTORY_FILE = path.join(process.cwd(), '..', '..', 'persistent_data', 'generated', 'imageHistory.json');

// 履歴データの初期化
let history: History = loadHistory();

/**
 * 履歴データの読み込み
 * @returns 履歴データ
 */
function loadHistory(): History {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, any>;
      const history = historySchema.parse(parsed);
      
      // 空の生成プロセスを削除
      Object.keys(history).forEach(generatorId => {
        if (history[generatorId].images.length === 0) {
          delete history[generatorId];
        }
      });
      
      return history;
    }
  } catch (error) {
    logger.error('Failed to load history file:', { error: error instanceof Error ? error.message : String(error) });
  }
  return {};
}

/**
 * 履歴データの保存
 * @param history 保存する履歴データ
 */
function saveHistory(history: History): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    logger.error('Failed to save history file:', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 新しい生成プロセスを開始
 * @param generatorId 生成プロセスID
 * @returns 生成プロセスID
 */
export function startNewGeneration(generatorId: string): string {
  logger.info(`Starting new generation process for generatorId: ${generatorId}`);
  
  // 既存の履歴と画像を削除
  if (history[generatorId]) {
    logger.info(`Found existing history for generatorId: ${generatorId}, cleaning up...`);
    const generator = history[generatorId];
    generator.images.forEach(image => {
      const imagePath = path.join(process.cwd(), '..', '..', 'persistent_data', 'generated', image.filename);
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          logger.debug(`Deleted old image file: ${imagePath}`);
        }
      } catch (error) {
        logger.error(`Failed to delete image file: ${imagePath}`, { error: error instanceof Error ? error.message : String(error) });
      }
    });
  } else {
    logger.info(`No existing history found for generatorId: ${generatorId}`);
  }

  // 新しい履歴を作成
  logger.info(`Creating new history for generatorId: ${generatorId}`);
  history[generatorId] = { images: [] };
  saveHistory(history);
  logger.info(`History created and saved for generatorId: ${generatorId}`);
  return generatorId;
}

/**
 * 画像を履歴に追加
 * @param generatorId 生成プロセスID
 * @param image 画像情報
 */
export function addImage(generatorId: string, image: Omit<ImageHistory, 'id'>): void {
  logger.info(`Adding image to history for generatorId: ${generatorId}`);
  
  if (!history[generatorId]) {
    logger.error(`Generator ${generatorId} not found in history`);
    throw new Error(`Generator ${generatorId} not found`);
  }

  const generator = history[generatorId];
  const newImage: ImageHistory = {
    id: generator.images.length + 1,  // 配列の長さ + 1 をIDとして使用
    ...image,
  };

  logger.info(`Adding image with ID: ${newImage.id}`);
  generator.images.push(newImage);
  saveHistory(history);
  logger.info(`Image added to history successfully for generatorId: ${generatorId}`);
}

/**
 * 生成プロセスの履歴を取得
 * @param generatorId 生成プロセスID
 * @returns 生成プロセスの履歴
 */
export function getHistory(generatorId: string): Generator {
  if (!history[generatorId]) {
    throw new Error(`Generator ${generatorId} not found`);
  }
  return history[generatorId];
}

/**
 * 生成プロセスを終了
 * @param generatorId 生成プロセスID
 * @param isSuccess 生成が成功したかどうか
 */
export function endGeneration(generatorId: string, isSuccess: boolean = false): void {
  if (!history[generatorId]) {
    throw new Error(`Generator ${generatorId} not found`);
  }

  if (isSuccess) {
    // 成功時のみ、古い画像をクリーンアップ
    const outputDir = path.join(process.cwd(), '..', '..', 'persistent_data', 'generated');
    
    // 全生成プロセスをループ
    Object.keys(history).forEach(id => {
      const generator = history[id];
      generator.images.forEach(image => {
        const imagePath = path.join(outputDir, image.filename);
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            logger.debug(`Deleted old image file: ${imagePath}`);
          }
        } catch (error) {
          logger.error(`Failed to delete image file: ${imagePath}`, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    });

    // 履歴をリセットし、現在の生成プロセスのみを保持
    const currentGenerator = history[generatorId];
    history = {
      [generatorId]: currentGenerator
    };
  }

  saveHistory(history);
}

/**
 * 全生成プロセスの履歴を取得
 * @returns 全生成プロセスの履歴
 */
export function getAllHistory(): History {
  return history;
} 