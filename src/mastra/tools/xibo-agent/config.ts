import path from 'path';
import fs from 'fs';
import { findUpSync } from 'find-up';
import { z } from "zod";

/**
 * Finds the project root by searching upwards for a package.json file.
 * @returns The absolute path to the project root directory.
 * @throws An error if the project root cannot be found.
 */
const findProjectRoot = (): string => {
  const packageJsonPath = findUpSync('package.json');
  if (!packageJsonPath) {
    throw new Error('Could not find project root containing a package.json.');
  }
  return path.dirname(packageJsonPath);
};

//const projectRoot = findProjectRoot();
const projectRoot = "/Users/miuramasataka/OpenSignage/xibo-agent";

export const config = {
  cmsUrl: process.env.CMS_URL || "",
  clientId: process.env.XIBO_CLIENT_ID || "",
  clientSecret: process.env.XIBO_CLIENT_SECRET || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  apiUrl: "http://localhost:4111/ext-api",

  // Define directories relative to the project root for stability.
  projectRoot: projectRoot,
  uploadDir: process.env.XIBO_UPLOAD_DIR || path.join(projectRoot, 'persistent_data', 'uploads'),
  downloadsDir: path.join(projectRoot, 'persistent_data', 'downloads'),
  generatedDir: path.join(projectRoot, 'persistent_data', 'generated'),
  previewFontImageDir: path.join(projectRoot, 'persistent_data', 'previewFontImage'),
  logsDir: path.join(projectRoot, 'logs'),
  publicDir: path.join(projectRoot, 'public'),
  reportsDir: path.join(projectRoot, 'persistent_data', 'reports'),
} as const;

export type Config = typeof config;
