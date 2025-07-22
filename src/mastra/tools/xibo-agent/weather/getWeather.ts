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

/**
 * @module getWeather
 * @description Provides a tool to fetch the current weather for a specified location
 * by first getting its coordinates and then querying a weather API.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { geocodingResponseSchema, weatherResponseSchema, weatherConditions } from './weatherTypes';
import { logger } from '../../../logger';

/**
 * Defines the schema for a successful tool execution.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z.object({
    temperature: z.number().describe("The current temperature in Celsius."),
    feelsLike: z.number().describe("The apparent temperature (what it feels like) in Celsius."),
    humidity: z.number().describe("The relative humidity as a percentage."),
    windSpeed: z.number().describe("The wind speed in km/h."),
    windGust: z.number().describe("The wind gust speed in km/h."),
    conditions: z.string().describe("A description of the current weather conditions."),
    location: z.string().describe("The name of the location found."),
  }),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z.any().optional().describe("Optional technical details about the error."),
});

/**
 * A tool to get the current weather for a specific location.
 */
export const getWeather = createTool({
  id: 'get-current-weather',
  description: 'Gets the current weather for a given location by name.',
  inputSchema: z.object({
    location: z.string().describe('The city name to get the weather for (e.g., "Tokyo").'),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    // Step 1: Geocode the location name to get coordinates.
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.location)}&count=1`;
    logger.debug(`Fetching coordinates for '${input.location}' from ${geocodingUrl}`);

    let geocodingData;
    try {
      const geocodingResponse = await fetch(geocodingUrl);
      if (!geocodingResponse.ok) {
        const message = `Geocoding API request failed with status: ${geocodingResponse.status}`;
        logger.error(message, { url: geocodingUrl });
        return { success: false, message, error: { statusCode: geocodingResponse.status } };
      }
      const rawData = await geocodingResponse.json();
      const validationResult = geocodingResponseSchema.safeParse(rawData);

      if (!validationResult.success) {
        const message = "Geocoding API response validation failed.";
        logger.error(message, { error: validationResult.error.issues, data: rawData });
        return { success: false, message, error: { validationIssues: validationResult.error.issues } };
      }
      geocodingData = validationResult.data;

    } catch (error: any) {
      const message = `Error during geocoding API call: ${error.message}`;
      logger.error(message, { error });
      return { success: false, message, error };
    }

    if (!geocodingData.results?.[0]) {
      const message = `Location '${input.location}' not found.`;
      logger.warn(message);
      return { success: false, message };
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    // Step 2: Fetch weather data using the obtained coordinates.
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;
    logger.debug(`Fetching weather for '${name}' from ${weatherUrl}`);

    try {
      const weatherResponse = await fetch(weatherUrl);
       if (!weatherResponse.ok) {
        const message = `Weather API request failed with status: ${weatherResponse.status}`;
        logger.error(message, { url: weatherUrl });
        return { success: false, message, error: { statusCode: weatherResponse.status } };
      }
      const rawData = await weatherResponse.json();
      const validationResult = weatherResponseSchema.safeParse(rawData);

      if (!validationResult.success) {
        const message = "Weather API response validation failed.";
        logger.error(message, { error: validationResult.error.issues, data: rawData });
        return { success: false, message, error: { validationIssues: validationResult.error.issues } };
      }
      
      const data = validationResult.data;

      return {
        success: true,
        data: {
          temperature: data.current.temperature_2m,
          feelsLike: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          windGust: data.current.wind_gusts_10m,
          conditions: weatherConditions[data.current.weather_code] || 'Unknown',
          location: name,
        }
      };
    } catch (error: any) {
      const message = `Error during weather API call: ${error.message}`;
      logger.error(message, { error });
      return { success: false, message, error };
    }
  },
}); 