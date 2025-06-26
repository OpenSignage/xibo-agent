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
 * @module weatherTypes
 * @description This module defines the Zod schemas and TypeScript types for validating
 * and handling data from the Open-Meteo weather and geocoding APIs.
 */

import { z } from 'zod';

/**
 * Schema for validating the response from the Open-Meteo Geocoding API.
 */
export const geocodingResponseSchema = z.object({
  results: z.array(z.object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string(),
  })).optional(),
});
export type GeocodingResponse = z.infer<typeof geocodingResponseSchema>;

/**
 * Schema for validating the current weather data from the Open-Meteo Forecast API.
 */
export const weatherResponseSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    wind_gusts_10m: z.number(),
    weather_code: z.number(),
  }),
});
export type WeatherResponse = z.infer<typeof weatherResponseSchema>;

/**
 * Schema for validating the weekly forecast data from the Open-Meteo Forecast API.
 */
export const weeklyWeatherResponseSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    weather_code: z.array(z.number()),
    precipitation_probability_max: z.array(z.number()),
  }),
});
export type WeeklyWeatherResponse = z.infer<typeof weeklyWeatherResponseSchema>;

/**
 * A mapping of WMO weather codes to human-readable descriptions.
 */
export const weatherConditions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}; 