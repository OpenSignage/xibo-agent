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
 * @module Get Library Tool
 *
 * This module provides a tool to search for media items in the Xibo CMS library
 * and display the results as a tree view.
 * It implements the 'GET /library' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySearchResponseSchema } from './schemas';
import { createTreeViewResponse, TreeNode } from '../utility/treeView';

// Schema for the input, based on the GET /library endpoint parameters
const inputSchema = z.object({
    mediaId: z.number().optional().describe("Filter by a specific Media ID."),
    media: z.string().optional().describe("Filter by Media item name (partial match)."),
    type: z.string().optional().describe("Filter by media type (e.g., 'image', 'video')."),
    ownerId: z.number().optional().describe("Filter by the User ID of the owner."),
    retired: z.number().int().min(0).max(1).optional().describe("Filter by retired status (0 or 1)."),
    tags: z.string().optional().describe("Filter by a comma-separated list of tags."),
    exactTags: z.number().int().min(0).max(1).optional().describe("A flag (0 or 1) indicating whether to treat the tags filter as an exact match."),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe("When filtering by multiple Tags, which logical operator should be used? AND|OR."),
    duration: z.string().optional().describe("Filter by duration, e.g., '10', 'lt|10', 'gt|10', 'le|10', 'ge|10'."),
    fileSize: z.string().optional().describe("Filter by file size in bytes, e.g., '1024', 'lt|1024'."),
    ownerUserGroupId: z.number().optional().describe("Filter by users belonging to a specific User Group ID."),
    folderId: z.number().optional().describe("Filter by Folder ID."),
    treeView: z.boolean().optional().default(false).describe("If true, a tree view of the library structure will be generated."),
});

// Schema for the tool's output, including tree view
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        data: librarySearchResponseSchema,
        tree: z.array(z.object({
            id: z.number(),
            name: z.string(),
            type: z.string(),
            depth: z.number(),
            isLast: z.boolean(),
            path: z.string(),
        })).optional(),
        treeViewText: z.string().optional(),
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
    }),
]);

/**
 * Builds a hierarchical tree structure from a flat list of media items.
 * This function is used to create a detailed, nested view for each media item,
 * organizing its properties like type, duration, and tags into a tree.
 * 
 * @param mediaItems The array of media items from the API.
 * @returns An array of TreeNode objects representing the library structure.
 */
function buildLibraryTree(mediaItems: z.infer<typeof librarySearchResponseSchema>): TreeNode[] {
    return mediaItems.map(media => {
        // Create the root node for the media item.
        const mediaNode: TreeNode = {
            id: media.mediaId,
            name: media.name,
            type: 'media',
            children: []
        };

        // Create a child node for general information.
        const infoNode: TreeNode = {
            id: -media.mediaId * 10 - 1,
            name: 'Information',
            type: 'info',
            children: [
                { id: -media.mediaId * 100 - 1, type: 'name', name: `Name: ${media.name}` },
                { id: -media.mediaId * 100 - 2, type: 'type', name: `Type: ${media.mediaType}` },
                { id: -media.mediaId * 100 - 3, type: 'duration', name: `Duration: ${media.duration}s` },
                { id: -media.mediaId * 100 - 4, type: 'size', name: `File Size: ${media.fileSize} bytes` },
                { id: -media.mediaId * 100 - 5, type: 'owner', name: `Owner ID: ${media.ownerId}` },
                { id: -media.mediaId * 100 - 6, type: 'folder', name: `Folder ID: ${media.folderId || 'N/A'}` },
            ]
        };
        mediaNode.children?.push(infoNode);

        // If the media has tags, create a child node for them.
        if (media.tags && media.tags.length > 0) {
            const tagsNode: TreeNode = {
                id: -media.mediaId * 20 - 1,
                name: 'Tags',
                type: 'tags',
                children: media.tags.map(tag => ({
                    id: tag.tagId,
                    name: tag.tag,
                    type: 'tag'
                }))
            };
            mediaNode.children?.push(tagsNode);
        }

        return mediaNode;
    });
}

/**
 * @tool Tool for Searching the Library with a Tree View
 *
 * This tool allows searching for media items in the Xibo CMS Library
 * and displays their properties in a tree structure.
 */
export const getLibrary = createTool({
    id: 'get-library',
    description: 'Search for media items in the Xibo Library and optionally display results as a tree.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        logger.info('Starting getLibrary tool execution with input:', input);

        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        try {
            const { treeView, ...mediaInput } = input;
            const headers = await getAuthHeaders();

            // Dynamically build query parameters from the input, excluding 'treeView'.
            const mediaParams = new URLSearchParams();
            for (const [key, value] of Object.entries(mediaInput)) {
                if (value !== undefined) {
                    mediaParams.append(key, String(value));
                }
            }
            const mediaUrl = `${config.cmsUrl}/api/library?${mediaParams.toString()}`;

            logger.debug(`getLibrary: Fetching from URL: ${mediaUrl}`);

            const mediaResponse = await fetch(mediaUrl, { headers });

            if (!mediaResponse.ok) {
                const errorData = await mediaResponse.json().catch(() => mediaResponse.statusText);
                return { success: false, message: `HTTP error fetching media! status: ${mediaResponse.status}`, error: errorData };
            }

            const mediaData = await mediaResponse.json();
            logger.info(`Successfully fetched ${Array.isArray(mediaData) ? mediaData.length : 0} media items.`);
            
            const parsedMedia = librarySearchResponseSchema.safeParse(mediaData);

            if (!parsedMedia.success) {
                logger.error('getLibrary: Zod validation failed for media data', { error: parsedMedia.error.format(), rawData: mediaData });
                return { success: false, message: 'Validation failed for the received library data.', error: parsedMedia.error.format() };
            }
            
            const allMedia = parsedMedia.data;

            // If tree view is not requested, return the flat list of media items.
            if (!treeView) {
                logger.info('Tree view not requested. Returning flat list of media.');
                return { success: true, data: allMedia };
            }
            
            // --- Tree View Generation ---
            logger.info('Tree view requested. Building library tree structure.');
            const libraryTree = buildLibraryTree(allMedia);
            
            logger.info('Successfully built library tree. Generating final response.');
            return createTreeViewResponse(allMedia, libraryTree, (node: TreeNode) => {
              // Custom formatter for the tree nodes to provide a better visual representation.
              if (node.type === 'media') {
                  return `📄 Media: ${node.name} (ID: ${node.id})`;
              }
              if (node.type === 'info') {
                  return `ℹ️ ${node.name}`;
              }
              if (node.type === 'tags') {
                  return `🏷️ ${node.name}`;
              }
              return node.name;
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error('getLibrary: Unexpected error', { error: errorMessage, details: error });
            return { success: false, message: errorMessage, error };
        }
    },
}); 