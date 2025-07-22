import { type Context } from 'hono';
import { resolve } from 'path';
import { config } from '../../tools/xibo-agent/config';

export const getFontImageHandler = async (c: Context) => {
  // ビルドツールの静的解析を回避するため、変数経由でrequireする
  const canvasPackage = 'canvas';
  const opentypePackage = 'opentype.js';
  const { createCanvas, registerFont } = require(canvasPackage);
  const opentype = require(opentypePackage);

  const { fontFamily, text } = c.req.param();
  const fontSize = parseInt(c.req.query('fontSize') || '32', 10);
  const fontPath = resolve(config.previewFontImageDir, `${fontFamily}.ttf`);

  try {
    const font = opentype.loadSync(fontPath);
    registerFont(fontPath, { family: fontFamily });

    const canvas = createCanvas(200, 200); // Temporary canvas to measure text
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

    const finalCanvas = createCanvas(
      Math.ceil(textWidth),
      Math.ceil(textHeight),
    );
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.font = `${fontSize}px ${fontFamily}`;
    finalCtx.fillStyle = 'black';
    finalCtx.fillText(text, 0, metrics.actualBoundingBoxAscent);

    const buffer = finalCanvas.toBuffer('image/png');

    c.header('Content-Type', 'image/png');
    return c.body(buffer);
  } catch (error) {
    console.error('Font loading or image generation error:', error);
    return c.json({ error: 'Failed to generate font image' }, 500);
  }
};