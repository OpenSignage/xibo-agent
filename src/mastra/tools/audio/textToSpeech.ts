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
 * @module textToSpeechTool
 * @description Synthesizes speech audio from text using the ElevenLabs API and saves it to disk.
 */

const successSchema = z.object({ filePath: z.string() });
const errorSchema = z.object({ success: z.literal(false), message: z.string(), error: z.any().optional() });
const successWrap = z.object({ success: z.literal(true), data: successSchema });

export const textToSpeechTool = createTool({
	id: 'text-to-speech',
	description: 'Converts text to speech using ElevenLabs and saves the audio to a file.',
	inputSchema: z.object({
		text: z.string().describe('Text to synthesize (max ~2500 chars recommended per call).'),
		voiceId: z.string().describe('ElevenLabs voice ID.'),
		modelId: z.string().optional().default('eleven_multilingual_v2').describe('ElevenLabs model ID.'),
		format: z.enum(['mp3', 'wav']).optional().default('mp3').describe('Output audio format.'),
		fileNameBase: z.string().optional().describe('Optional base filename; a timestamp and extension will be added.'),
	}),
	outputSchema: z.union([successWrap, errorSchema]),
	execute: async ({ context }) => {
		const { text, voiceId, modelId = 'eleven_multilingual_v2', format = 'mp3', fileNameBase } = context;
		const apiKey = process.env.ELEVENLABS_API_KEY;
		if (!apiKey) {
			const message = 'ELEVENLABS_API_KEY is not set.';
			logger.error(message);
			return { success: false, message } as const;
		}
		try {
			const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
			const accept = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
			const body = {
				text,
				model_id: modelId,
				audio_format: format === 'wav' ? 'wav' : 'mp3_44100',
			};
			const resp = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'xi-api-key': apiKey,
					'Content-Type': 'application/json',
					'Accept': accept,
				},
				body: JSON.stringify(body),
			});
			if (!resp.ok) {
				const errText = await resp.text().catch(() => '');
				const message = `TTS request failed: ${resp.status}`;
				logger.error({ status: resp.status, errText }, message);
				return { success: false, message, error: errText } as const;
			}
			const buf = Buffer.from(await resp.arrayBuffer());
			const outDir = path.join(config.generatedDir, 'podcast');
			await fs.mkdir(outDir, { recursive: true });
			const stamp = new Date().toISOString().replace(/[:.]/g, '-');
			const base = (fileNameBase || 'segment') + '-' + stamp + `.${format}`;
			const filePath = path.join(outDir, base);
			await fs.writeFile(filePath, buf);
			logger.info({ filePath, bytes: buf.length }, 'Saved synthesized audio.');
			return { success: true, data: { filePath } } as const;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown TTS error';
			logger.error({ error }, 'TTS failed');
			return { success: false, message, error } as const;
		}
	},
});