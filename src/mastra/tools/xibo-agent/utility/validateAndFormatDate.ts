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
 * 日付文字列をY-m-dフォーマットに変換します
 * @param dateStr 変換する日付文字列
 * @returns 変換された日付文字列（Y-m-d形式）または無効な日付の場合はnull
 */
export const validateAndFormatDate = (dateStr: string): string | null => {
  try {
    // 様々な日付フォーマットに対応
    const date = new Date(dateStr);
    
    // 無効な日付の場合はnullを返す
    if (isNaN(date.getTime())) {
      return null;
    }

    // Y-m-d フォーマットに変換
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("[DEBUG] 日付の変換に失敗しました:", error);
    return null;
  }
}; 