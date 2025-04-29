import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { WeatherResponse, weatherConditions } from './types';

const getWeatherByCoordinates = async (latitude: number, longitude: number) => {
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

export const weatherByCoordinatesTool = createTool({
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
    return await getWeatherByCoordinates(context.latitude, context.longitude);
  },
}); 