import { config } from "../config";

export const getAuthHeaders = async () => {
  return {
    "Content-Type": "application/json",
    "X-API-KEY": config.apiKey,
  };
}; 