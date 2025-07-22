/**
 * @license
 * Copyright 2024 Mastra AI. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @module getWeeklyWeather
 * @description Provides a tool to fetch the weekly weather forecast for a specified location.
 * It first geocodes the location name to get coordinates and then queries the weather API.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  geocodingResponseSchema,
  weeklyWeatherResponseSchema,
  weatherConditions,
} from './weatherTypes';
import { logger } from '../../../logger';

/**
 * Defines the schema for a successful tool execution.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z.object({
    forecasts: z.array(
      z.object({
        date: z.string(),
        maxTemp: z.number(),
        minTemp: z.number(),
        conditions: z.string(),
        precipitationProbability: z.number(),
      })
    ),
    location: z.string(),
  }),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A human-readable error message.'),
  error: z.any().optional().describe('Optional technical details about the error.'),
});

/**
 * A tool to get the weekly weather forecast for a location.
 * It takes a location name, finds its coordinates, and returns the 8-day forecast.
 */
export const getWeeklyWeather = createTool({
  id: 'get-weekly-weather',
  description: 'Get weekly weather forecast for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    logger.info(`Getting weekly weather for ${input.location}`);
    try {
      // Step 1: Geocode the location name to get coordinates.
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        input.location
      )}&count=1`;
      const geocodingResponse = await fetch(geocodingUrl);
      if (!geocodingResponse.ok) {
        const message = `Geocoding API request failed with status: ${geocodingResponse.status}`;
        logger.error(message, { url: geocodingUrl });
        return {
          success: false,
          message,
          error: { statusCode: geocodingResponse.status },
        };
      }
      const rawGeocodingData = await geocodingResponse.json();
      const geocodingValidation =
        geocodingResponseSchema.safeParse(rawGeocodingData);

      if (!geocodingValidation.success) {
        const message = 'Geocoding API response validation failed.';
        logger.error(message, {
          error: geocodingValidation.error.issues,
          data: rawGeocodingData,
        });
        return {
          success: false,
          message,
          error: { validationIssues: geocodingValidation.error.issues },
        };
      }
      const geocodingData = geocodingValidation.data;

      if (!geocodingData.results?.[0]) {
        const message = `Location '${input.location}' not found.`;
        logger.warn(message);
        return { success: false, message };
      }

      const { latitude, longitude, name } = geocodingData.results[0];
      logger.info(`Found location: ${name} (${latitude}, ${longitude})`);

      // Step 2: Fetch weekly weather data using the obtained coordinates.
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&forecast_days=8&timezone=auto`;

      const response = await fetch(weatherUrl);
      if (!response.ok) {
        const message = `Weather API request failed with status: ${response.status}`;
        logger.error(message, { url: weatherUrl });
        return { success: false, message, error: { statusCode: response.status } };
      }
      const rawWeatherData = await response.json();
      const weatherValidation =
        weeklyWeatherResponseSchema.safeParse(rawWeatherData);

      if (!weatherValidation.success) {
        const message = 'Weather API response validation failed.';
        logger.error(message, {
          error: weatherValidation.error.issues,
          data: rawWeatherData,
        });
        return {
          success: false,
          message,
          error: { validationIssues: weatherValidation.error.issues },
        };
      }
      const data = weatherValidation.data;

      if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
        const message = 'Failed to fetch weather data: No daily data available';
        logger.warn(message);
        return { success: false, message };
      }

      const forecasts = data.daily.time.map((date, index) => ({
        date,
        maxTemp: data.daily.temperature_2m_max[index],
        minTemp: data.daily.temperature_2m_min[index],
        conditions:
          weatherConditions[data.daily.weather_code[index]] || 'Unknown',
        precipitationProbability:
          data.daily.precipitation_probability_max[index],
      }));
      logger.info(`Successfully retrieved weekly weather for ${name}`);

      return {
        success: true,
        data: {
          forecasts,
          location: name,
        },
      };
    } catch (error: any) {
      const message = `An unexpected error occurred: ${error.message}`;
      logger.error('Error getting weekly weather', {
        location: input.location,
        error,
      });
      return { success: false, message, error };
    }
  },
}); 