import path from 'path';

export const config = {
  baseUrl: 'https://sigme.net/manual-r4/ja/',
  paths: {
    root: process.env.APP_ROOT || '/Users/miuramasataka/OpenSignage/xibo-agent',
    contents: 'src/mastra/tools/xibo-manual/contents'
  }
} as const;

export type Config = typeof config; 