/*
 * Upload a PPTX to Google Drive and convert to Google Slides.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'node:fs';
import { google } from 'googleapis';
import { logger } from '../../logger';

const outputSchema = z.object({ id: z.string(), webViewLink: z.string().optional() });
const errorResponseSchema = z.object({ success: z.literal(false), message: z.string(), error: z.any().optional() });
const successResponseSchema = z.object({ success: z.literal(true), data: outputSchema });

export const uploadToGoogleSlidesTool = createTool({
  id: 'upload-to-google-slides',
  description: 'Uploads a PPTX file to Google Drive and converts it to Google Slides.',
  inputSchema: z.object({
    pptxPath: z.string().describe('Absolute path to the PPTX file'),
    name: z.string().describe('Target Google Slides file name'),
    folderId: z.string().optional().describe('Optional Drive folder ID to save into'),
    serviceAccountJson: z.string().optional().describe('Service account JSON (stringified). If omitted, read from process.env.GSA_KEY_JSON'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    try {
      const { pptxPath, name, folderId, serviceAccountJson } = context as any;
      logger.info({ pptxPath, name, hasFolderId: !!folderId }, 'Preparing Google Slides upload');
      const credentials = JSON.parse(serviceAccountJson || process.env.GSA_KEY_JSON || '{}');
      if (!credentials || !credentials.client_email) {
        logger.warn('Service account JSON missing or invalid');
        return { success: false, message: 'Missing service account JSON (GSA_KEY_JSON).' } as const;
      }
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      const drive = google.drive({ version: 'v3', auth });

      const fileMetadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.presentation',
        ...(folderId ? { parents: [folderId] } : {}),
      };
      const media = {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        body: fs.createReadStream(pptxPath),
      } as any;

      logger.info({ targetFolder: folderId || '(root)' }, 'Uploading file to Drive');
      const res = await drive.files.create({ requestBody: fileMetadata, media, fields: 'id, webViewLink', supportsAllDrives: true });
      logger.info({ fileId: res.data.id, hasWebViewLink: !!res.data.webViewLink }, 'Drive upload finished');
      const link: string | undefined = res.data.webViewLink ?? undefined;
      return { success: true, data: { id: res.data.id!, webViewLink: link } } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload to Google Slides';
      logger.error({ error }, 'Google Slides upload error');
      return { success: false, message, error } as const;
    }
  },
});

