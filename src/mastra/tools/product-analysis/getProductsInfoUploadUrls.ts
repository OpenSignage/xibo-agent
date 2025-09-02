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

/**
 * @module getProductsInfoUploadUrlsTool
 * @description Build upload/form URLs bound to current threadId for products_info uploads.
 */
export const getProductsInfoUploadUrlsTool = createTool({
  id: 'get-products-info-upload-urls',
  description: 'Return upload/form URL for products_info using productName. No network calls.',
  inputSchema: z.object({
    productName: z.string().describe('Target product name (used as subdirectory under products_info). This field is required.'),
  }),
  outputSchema: z.object({ formUrl: z.string(), productName: z.string() }),
  execute: async ({ context }) => {
    const { productName } = context as { productName: string };
    // Build form URL with path parameter
    const formUrl = `/ext-api/products_info/upload-form/${encodeURIComponent(productName)}`;
    return { formUrl, productName } as const;
  },
});

