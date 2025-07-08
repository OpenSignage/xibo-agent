import path from 'path';
import { findUpSync } from 'find-up';

const projectRoot = path.dirname(findUpSync('package.json') || '');

export const config = {
  baseUrl: 'https://sigme.net/manual-r4/ja/',
  imageBaseUrl: 'https://xibosignage.com/',
  paths: {
    root: projectRoot,
    contents: path.join(projectRoot, 'src/mastra/tools/xibo-manual/contents'),
  },
} as const;

export type Config = typeof config; 