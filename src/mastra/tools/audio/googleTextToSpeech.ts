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

const successSchema = z.object({ filePath: z.string() });
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
	}),
	outputSchema: z.union([successWrap, errorSchema]),
	execute: async ({ context }) => {
		const { text, voiceName, languageCode = 'ja-JP', speakingRate = 1.0, pitch = 0.0, format = 'mp3', fileNameBase, outDir } = context;
		const apiKey = process.env.GOOGLE_TTS_API_KEY;
		if (!apiKey) {
			const message = 'GOOGLE_TTS_API_KEY is not set.';
			logger.error(message);
			return { success: false, message } as const;
		}
		try {
			const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
			const audioEncoding = format === 'wav' ? 'LINEAR16' : 'MP3';
			const body = {
				input: { text },
				voice: voiceName ? { name: voiceName, languageCode } : { languageCode },
				audioConfig: { audioEncoding, speakingRate, pitch },
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
			const outDirFinal = outDir || path.join(config.generatedDir, 'podcast');
			await fs.mkdir(outDirFinal, { recursive: true });
			const stamp = new Date().toISOString().replace(/[:.]/g, '-');
			const base = (fileNameBase || 'segment') + '-' + stamp + `.${format}`;
			const filePath = path.join(outDirFinal, base);
			await fs.writeFile(filePath, buf);
			logger.info({ filePath, bytes: buf.length }, 'Saved Google TTS audio.');
			return { success: true, data: { filePath } } as const;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown Google TTS error';
			logger.error({ error }, 'Google TTS failed');
			return { success: false, message, error } as const;
		}
	},
});