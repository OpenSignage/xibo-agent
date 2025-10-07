export const BASE_URL = process.env.MASTRA_BASE_URL || 'http://localhost:4111';
export const EXT_API_BASE = `${BASE_URL}/ext-api`;

// Common download API paths
export const DOWNLOAD_API_REPORT = `${EXT_API_BASE}/download/report`;
export const DOWNLOAD_API_PODCAST = `${EXT_API_BASE}/download/podcast`;
export const GET_IMAGE_API = `${EXT_API_BASE}/getImage`;
export const GET_VIDEO_API = `${EXT_API_BASE}/getVideo`;

