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
import { getGoogleFonts } from './getGoogleFonts';
import { getUploadFiles } from './getUploadFiles';
import { deleteUploadFiles } from './deleteUploadFiles';
import { uploadGoogleFonts } from './uploadGoogleFonts';
import { getLatestPlayer } from './getLatestPlayer';

export const etcTools = [
  getGoogleFonts,
  getUploadFiles,
  deleteUploadFiles,
  uploadGoogleFonts,
  getLatestPlayer,
];

export {
  getGoogleFonts,
  getUploadFiles,
  deleteUploadFiles,
  uploadGoogleFonts,
  getLatestPlayer,
};