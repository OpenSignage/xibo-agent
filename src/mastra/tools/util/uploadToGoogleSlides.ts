/*
 * Upload a PPTX to Google Drive and convert to Google Slides.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'node:fs';
// Do NOT import googleapis at top-level to avoid module resolution errors when not installed

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
      const credentials = JSON.parse(serviceAccountJson || process.env.GSA_KEY_JSON || '{}');
      if (!credentials || !credentials.client_email) {
        return { success: false, message: 'Missing service account JSON (GSA_KEY_JSON).' } as const;
      }
      // Lazy import googleapis only when actually uploading
      let google: any;
      try {
        google = (await import('googleapis')).google;
      } catch (e) {
        return { success: false, message: 'googleapis is not installed. Please run: npm i googleapis' } as const;
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

      const res = await drive.files.create({ requestBody: fileMetadata, media, fields: 'id, webViewLink' });
      return { success: true, data: { id: res.data.id!, webViewLink: res.data.webViewLink } } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload to Google Slides';
      return { success: false, message, error } as const;
    }
  },
});

