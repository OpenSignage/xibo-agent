import path from 'path';
import { z } from "zod";

export const config = {
  cmsUrl: process.env.CMS_URL || "",
  clientId: process.env.XIBO_CLIENT_ID || "",
  clientSecret: process.env.XIBO_CLIENT_SECRET || "",
  uploadDir: process.env.XIBO_UPLOAD_DIR || path.join(process.cwd(), 'output', 'upload'),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
} as const;

export type Config = typeof config;
