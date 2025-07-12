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
 * @module tidyLibrary
 * @description Provides a tool to perform a routine tidy of the Xibo CMS library,
 * removing unused media files. It implements the 'DELETE /library/tidy' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

/**
 * Zod schema for the tool's input.
 * Corresponds to the parameters for the DELETE /library/tidy endpoint.
 */
const inputSchema = z.object({
    tidyGenericFiles: z.number().int().min(0).max(1).optional().describe("Set to 1 to also delete generic files."),
});

/**
 * Zod schema for the tool's output.
 * Defines a structured response for both success and failure cases.
 */
const outputSchema = z.object({
    success: z.boolean().describe("Indicates whether the operation was successful."),
    message: z.string().optional().describe("A summary message of the operation result."),
    error: z.any().optional().describe("Detailed error information if the operation failed."),
    errorData: z.any().optional().describe("Raw error data from the API response."),
});

/**
 * @tool tidyLibrary
 * @description A tool for tidying the CMS library by removing unused files.
 */
export const tidyLibrary = createTool({
    id: 'tidy-library',
    description: 'Tidies the library by removing unused files.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        if (!config.cmsUrl) {
            logger.error({}, 'tidyLibrary: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/library/tidy`;
        const params = new URLSearchParams();
        if (input.tidyGenericFiles !== undefined) {
            params.append('tidyGenericFiles', String(input.tidyGenericFiles));
        }

        logger.debug({ url, params: input }, 'tidyLibrary: Attempting to DELETE');

        try {
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            const response = await fetch(url, {
                method: 'DELETE',
                headers,
                body: params,
            });

            // A 200 OK or 204 No Content response indicates a successful operation.
            if (response.status === 200 || response.status === 204) {
                const successMessage = 'Library tidy operation completed successfully.';
                logger.info({}, successMessage);
                return { success: true, message: successMessage };
            }

            // Handle non-successful responses as errors.
            const errorData = await response.json().catch(() => response.statusText);
            logger.error(
                { status: response.status, statusText: response.statusText, data: errorData },
                'tidyLibrary: HTTP error occurred.'
            );
            return { success: false, message: `HTTP error! status: ${response.status}`, errorData };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error(
                { error: errorMessage, details: error },
                'tidyLibrary: An unexpected error occurred during execution.'
            );
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 