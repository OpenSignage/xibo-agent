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
 * QR Code Generation Tool
 * 
 * This module provides functionality to generate QR codes from text content.
 * It creates PNG format QR code images and saves them to the persistent storage
 * directory for later use in Xibo digital signage displays.
 */

import * as QRCode from 'qrcode';
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { logger } from "../../../index";
import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '../config';

// Schema for successful QR code generation response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    fileName: z.string().describe('Name of the generated QR code file'),
    filePath: z.string().describe('Full path to the generated QR code file'),
    size: z.number().describe('Size of the generated QR code in pixels'),
    content: z.string().describe('Content encoded in the QR code')
  })
});

// Schema for error response
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('Error message describing what went wrong'),
  error: z.any().optional().describe('Detailed error information'),
  errorData: z.any().optional().describe('Additional error context data')
});

// Union schema for all possible responses
const responseSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool for generating QR codes
 * 
 * This tool generates QR codes from text content and saves them as PNG images
 * in the persistent storage directory.
 */
export const generateQRCode = createTool({
  id: 'xibo-generate-qrcode',
  description: 'Generate QR code images from text content and save them to persistent storage',
  inputSchema: z.object({
    content: z.string().describe('Text content to encode in the QR code (required)'),
    fileName: z.string().describe('Output file name for the PNG image (without extension)'),
    size: z.number().default(500).describe('Size of the QR code in pixels (default: 500px)')
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    try {
      const { content, fileName, size = 500 } = context;

      logger.info('Starting QR code generation', { 
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        fileName,
        size 
      });

      // Validate input parameters
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          message: 'Content cannot be empty'
        };
      }

      if (!fileName || fileName.trim().length === 0) {
        return {
          success: false,
          message: 'File name cannot be empty'
        };
      }

      if (size < 100 || size > 2000) {
        return {
          success: false,
          message: 'Size must be between 100 and 2000 pixels'
        };
      }

      // Ensure the output directory exists
      const outputDir = config.generatedDir;
      const fullFileName = `${fileName.replace(/\.png$/i, '')}.png`;
      const filePath = join(outputDir, fullFileName);

      try {
        await fs.mkdir(outputDir, { recursive: true });
        logger.debug('Output directory ensured', { outputDir });
      } catch (error) {
        logger.error('Failed to create output directory', { error, outputDir });
        return {
          success: false,
          message: 'Failed to create output directory',
          error: error instanceof Error ? error.message : 'Unknown directory creation error'
        };
      }

      // Generate QR code options
      const qrOptions = {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M' as const
      };

      try {
        // Generate QR code and save to file
        await QRCode.toFile(filePath, content, qrOptions);
        
        logger.info('QR code generated successfully', { 
          filePath,
          size,
          contentLength: content.length 
        });

        return {
          success: true,
          data: {
            fileName: fullFileName,
            filePath: filePath,
            size: size,
            content: content
          }
        };

      } catch (qrError) {
        logger.error('QR code generation failed', { error: qrError, content: content.substring(0, 100) });
        return {
          success: false,
          message: 'Failed to generate QR code',
          error: qrError instanceof Error ? qrError.message : 'Unknown QR generation error',
          errorData: { content: content.substring(0, 100), qrOptions }
        };
      }

    } catch (error) {
      logger.error('Unexpected error in QR code generation', { error });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
});
