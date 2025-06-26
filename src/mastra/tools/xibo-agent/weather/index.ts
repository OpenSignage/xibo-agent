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
 * @module weather
 * @description This module exports all the tools and types related to weather functionalities.
 * It serves as a central point for accessing weather-related features.
 */

export { getWeather } from './getWeather';
export { getWeatherByCoordinates } from './getWeatherByCoordinates';
export { getWeeklyWeather } from './getWeeklyWeather'; 
export {
  geocodingResponseSchema,
  type GeocodingResponse,
  weatherResponseSchema,
  type WeatherResponse,
  weeklyWeatherResponseSchema,
  type WeeklyWeatherResponse,
  weatherConditions,
} from './weatherTypes';
