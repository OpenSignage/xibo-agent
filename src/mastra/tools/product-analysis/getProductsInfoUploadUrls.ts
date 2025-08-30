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
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { v4 as uuidv4 } from 'uuid';
// Note: workingMemoryへの保存はエージェント側で行う（ツール内では行わない）

/**
 * @module getProductsInfoUploadUrlsTool
 * @description Build upload/form URLs bound to current threadId for products_info uploads.
 */
export const getProductsInfoUploadUrlsTool = createTool({
  id: 'get-products-info-upload-urls',
  description: 'Return upload/form URLs for products_info using current threadId. No network calls.',
  inputSchema: z.object({
    returnUrl: z.string().optional(),
    threadId: z.string().optional(), // 明示指定があれば優先
  }),
  outputSchema: z.object({ formUrl: z.string(), threadId: z.string() }),
  execute: async ({ context, runtimeContext }) => {
    const rc: any = runtimeContext || {};
    const resolvedThreadId = String(
      (context as any)?.threadId || rc.threadId || rc.threadID || rc.thread?.id || rc.metadata?.threadId || ''
    );
    const threadIdToUse = resolvedThreadId || uuidv4();
    // formUrl は threadId が無くても開ける（入力欄が表示される）
    const baseForm = '/ext-api/threads/products_info/upload-form';
    const formUrl = `${baseForm}?threadId=${encodeURIComponent(threadIdToUse)}${context.returnUrl ? `&return=${encodeURIComponent(context.returnUrl)}` : ''}`;

    return { formUrl, threadId: threadIdToUse } as const;
  },
});

