import { config } from "./config";

export const getAccessToken = async () => {
  console.log(`Requesting access token from: ${config.cmsUrl}/api/authorize/access_token`);
  
  const response = await fetch(`${config.cmsUrl}/api/authorize/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Access token error response: ${errorText}`);
    throw new Error(`トークン取得エラー: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`Access token obtained successfully`);
  return data.access_token;
};

export const getAuthHeaders = async () => {
  const accessToken = await getAccessToken();
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };
  
  return headers;
}; 