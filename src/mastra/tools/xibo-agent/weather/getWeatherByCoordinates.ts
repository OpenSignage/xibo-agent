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
 * @module getWeatherByCoordinates
 * @description Defines a tool for fetching the current weather conditions for a given
 * pair of latitude and longitude coordinates.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { WeatherResponse, weatherConditions } from './weatherTypes';

/**
 * Fetches weather data from the Open-Meteo API using latitude and longitude.
 * @param latitude The latitude for the weather query.
 * @param longitude The longitude for the weather query.
 * @returns A promise that resolves to the current weather data.
 */
const getCoordinatesWeather = async (latitude: number, longitude: number) => {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as WeatherResponse;

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: weatherConditions[data.current.weather_code] || 'Unknown',
    coordinates: {
      latitude,
      longitude
    }
  };
};

/**
 * A tool to get the current weather for a given set of coordinates.
 * It takes latitude and longitude as input and returns detailed weather conditions.
 */
export const getWeatherByCoordinates = createTool({
  id: 'get-weather-by-coordinates',
  description: 'Get current weather for given coordinates',
  inputSchema: z.object({
    latitude: z.number().describe('Latitude'),
    longitude: z.number().describe('Longitude'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    })
  }),
  execute: async ({ context }) => {
    return await getCoordinatesWeather(context.latitude, context.longitude);
  },
}); 