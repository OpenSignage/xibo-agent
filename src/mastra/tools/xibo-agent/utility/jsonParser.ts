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

import { logger } from '../../../logger';

/**
 * オブジェクト内のJSON文字列を再帰的に検出してパースする
 * @param obj 処理対象のオブジェクト
 * @returns パース済みのオブジェクト
 */
export function parseJsonStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 配列の場合は各要素を処理
  if (Array.isArray(obj)) {
    return obj.map(item => parseJsonStrings(item));
  }

  // オブジェクトの場合は各プロパティを処理
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = parseJsonStrings(value);
    }
    return result;
  }

  // 文字列の場合、JSON文字列かどうかをチェック
  if (typeof obj === 'string') {
    let jsonString = obj.trim();
    
    // Check for markdown code block and extract JSON
    const jsonMatch = jsonString.match(/```(json)?\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[2]) {
        jsonString = jsonMatch[2];
    }

    // JSON文字列の特徴的なパターンをチェック
    if (jsonString.trim().startsWith('[') || jsonString.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(jsonString);
        // パース成功した場合、再帰的に処理
        return parseJsonStrings(parsed);
      } catch (e) {
        // パースに失敗した場合は元の文字列を返す
        return obj;
      }
    }
  }

  // その他の型はそのまま返す
  return obj;
} 