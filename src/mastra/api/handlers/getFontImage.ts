import { Context } from 'hono';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../../tools/xibo-agent/config';
import { logger } from '../../index';

/**
 * Handles requests to serve font preview images.
 * It retrieves the filename from the request parameters, locates the image
 * in the configured preview directory, and sends it as a response.
 *
 * @param c The Hono context object.
 */
export async function getFontImage(c: Context) {
  const { fileName } = c.req.param();
  if (!fileName) {
    logger.warn('getFontImage: No fileName provided in the request.');
    return c.json({ message: 'Bad Request: No filename specified.' }, 400);
  }

  try {
    const filePath = path.join(config.previewFontImageDir, fileName);

    // Security check to prevent path traversal attacks
    if (path.dirname(filePath) !== config.previewFontImageDir) {
        logger.error(`getFontImage: Path traversal attempt detected for fileName: ${fileName}`);
        return c.json({ message: 'Forbidden: Invalid file path.' }, 403);
    }

    if (!fs.existsSync(filePath)) {
      logger.info(`getFontImage: File not found at path: ${filePath}`);
      return c.json({ message: 'Not Found: The requested image does not exist.' }, 404);
    }

    const imageBuffer = fs.readFileSync(filePath);
    logger.info(`getFontImage: Serving file: ${filePath}`);
    return c.body(imageBuffer, {
        headers: {
            'Content-Type': 'image/png'
        }
    });
    
  } catch (error: any) {
    logger.error(`getFontImage: An unexpected error occurred while serving ${fileName}: ${error.message}`, { error });
    return c.json({ message: 'Internal Server Error' }, 500);
  }
} 