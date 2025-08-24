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
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../logger';
import { config } from '../xibo-agent/config';
import path from 'path';
import fs from 'fs/promises';

/**
 * @module googleTextToSpeechTool
 * @description Synthesizes speech using Google Cloud Text-to-Speech (v1) via REST API key and saves to file.
 */

// In-memory pronunciation dictionary cache (by absolute path)
const dictCache = new Map<string, { entries: Array<[RegExp, string]> }>();

// Normalization helpers shared across calls
const normalizeForMatching = (s: string) => {
  // NFKC covers most width variants (e.g., half-width Katakana → full-width)
  let n = s.normalize('NFKC');
  // Normalize prolonged sound mark variants to standard "ー"
  n = n.replace(/[ｰ‐―–—]/g, 'ー');
  // Normalize middle dot variants to "・"
  n = n.replace(/[･·∙•]/g, '・');
  // Convert full-width spaces to regular space and collapse multiples
  n = n.replace(/\u3000/g, ' ').replace(/\s{2,}/g, ' ');
  return n;
};
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const successSchema = z.union([
	z.object({ filePath: z.string() }),
	z.object({ buffer: z.any(), bufferSize: z.number() }),
]);
const errorSchema = z.object({ success: z.literal(false), message: z.string(), error: z.any().optional() });
const successWrap = z.object({ success: z.literal(true), data: successSchema });

export const googleTextToSpeechTool = createTool({
	id: 'google-text-to-speech',
	description: 'Converts text to speech using Google Cloud Text-to-Speech and saves the audio to a file.',
	inputSchema: z.object({
		text: z.string().describe('Text to synthesize.'),
		voiceName: z.string().optional().describe('Google TTS voice name, e.g., ja-JP-Neural2-B.'),
		languageCode: z.string().optional().default('ja-JP').describe('BCP-47 language code, e.g., ja-JP.'),
		speakingRate: z.number().optional().default(1.0).describe('Speaking rate (0.25-4.0).'),
		pitch: z.number().optional().default(0.0).describe('Pitch (-20.0 to 20.0).'),
		format: z.enum(['mp3','wav']).optional().default('mp3').describe('Output audio format.'),
		fileNameBase: z.string().optional().describe('Optional base filename.'),
		outDir: z.string().optional().describe('Optional output directory for the audio file.'),
		pronunciationDictPath: z.string().optional().describe('Optional path to a JSON dictionary (word -> reading) applied before TTS.'),
		returnBuffer: z.boolean().optional().describe('If true, return audio Buffer instead of writing a file.'),
	}),
	outputSchema: z.union([successWrap, errorSchema]),
	execute: async ({ context }) => {
		const { text, voiceName, languageCode = 'ja-JP', speakingRate = 1.0, pitch = 0.0, format = 'mp3', fileNameBase, outDir, pronunciationDictPath, returnBuffer } = context as any;
		const apiKey = process.env.GOOGLE_TTS_API_KEY;
		if (!apiKey) {
			const message = 'GOOGLE_TTS_API_KEY is not set.';
			logger.error(message);
			return { success: false, message } as const;
		}
		try {
			// Apply full-width/half-width normalization and pronunciation dictionary if provided
			let processedText = normalizeForMatching(text);
			if (pronunciationDictPath) {
				try {
					const abs = path.isAbsolute(pronunciationDictPath) ? pronunciationDictPath : path.join(config.projectRoot, pronunciationDictPath);
					let cached = dictCache.get(abs);
					if (!cached) {
						await fs.access(abs);
						const raw = await fs.readFile(abs, 'utf-8');
						const dict = JSON.parse(raw) as Record<string, string>;
						const entries: Array<[RegExp, string]> = [];
						for (const [from, to] of Object.entries(dict)) {
							if (typeof from !== 'string' || typeof to !== 'string' || from.length === 0) continue;
							const fromNorm = normalizeForMatching(from);
							entries.push([new RegExp(escapeRegExp(fromNorm), 'gi'), to]);
						}
						cached = { entries };
						dictCache.set(abs, cached);
						logger.debug({ entries: entries.length, path: abs }, 'Loaded pronunciation dictionary into cache.');
					}
					for (const [re, to] of cached.entries) {
						processedText = processedText.replace(re, to);
					}
					logger.debug({ entries: cached.entries.length, path: abs }, 'Applied normalization and pronunciation dictionary (cached).');
				} catch (e) {
					// Non-fatal: log and continue with original text
					logger.warn({ pronunciationDictPath, message: (e as any)?.message }, 'Failed to apply pronunciation dictionary.');
				}
			}
			const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
			const audioEncoding = format === 'wav' ? 'LINEAR16' : 'MP3';
			// Force a standard sample rate to avoid speed/pitch issues when concatenating with external assets
			const targetSampleRate = 44100;
			const body = {
				input: { text: processedText },
				voice: voiceName ? { name: voiceName, languageCode } : { languageCode },
				audioConfig: { audioEncoding, speakingRate, pitch, sampleRateHertz: targetSampleRate },
			};
			const resp = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!resp.ok) {
				const errText = await resp.text().catch(() => '');
				const message = `Google TTS failed: ${resp.status}`;
				logger.error({ status: resp.status, errText }, message);
				return { success: false, message, error: errText } as const;
			}
			const data = await resp.json();
			const audioContent = data.audioContent as string | undefined;
			if (!audioContent) {
				const message = 'No audioContent in Google TTS response';
				logger.error(message);
				return { success: false, message } as const;
			}
			const buf = Buffer.from(audioContent, 'base64');
			if (returnBuffer) {
				logger.debug({ bytes: buf.length }, 'Generated Google TTS audio (buffer mode).');
				return { success: true, data: { buffer: buf, bufferSize: buf.length } } as const;
			}
			const outDirFinal = outDir || path.join(config.generatedDir, 'podcast');
			await fs.mkdir(outDirFinal, { recursive: true });
			const stamp = new Date().toISOString().replace(/[:.]/g, '-');
			const base = (fileNameBase || 'segment') + '-' + stamp + `.${format}`;
			const filePath = path.join(outDirFinal, base);
			await fs.writeFile(filePath, buf);
			logger.debug({ filePath, bytes: buf.length }, 'Saved Google TTS audio.');
			return { success: true, data: { filePath } } as const;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown Google TTS error';
			logger.error({ error }, 'Google TTS failed');
			return { success: false, message, error } as const;
		}
	},
});