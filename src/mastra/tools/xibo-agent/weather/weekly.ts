import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GeocodingResponse, WeeklyWeatherResponse, weatherConditions } from './types';

const getWeeklyWeather = async (location: string) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&forecast_days=8&timezone=auto`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as WeeklyWeatherResponse;

  if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
    throw new Error('Failed to fetch weather data');
  }

  const forecasts = data.daily.time.map((date, index) => ({
    date,
    maxTemp: data.daily.temperature_2m_max[index],
    minTemp: data.daily.temperature_2m_min[index],
    conditions: weatherConditions[data.daily.weather_code[index]] || 'Unknown',
    precipitationProbability: data.daily.precipitation_probability_max[index],
  }));

  return {
    forecasts,
    location: name,
  };
};

export const weeklyWeatherTool = createTool({
  id: 'get-weekly-weather',
  description: 'Get weekly weather forecast for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    forecasts: z.array(z.object({
      date: z.string(),
      maxTemp: z.number(),
      minTemp: z.number(),
      conditions: z.string(),
      precipitationProbability: z.number(),
    })),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeeklyWeather(context.location);
  },
}); 