import { config } from "./config";

export const getAccessToken = async () => {
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
    throw new Error(`トークン取得エラー: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
};

export const getAuthHeaders = async () => {
  const accessToken = await getAccessToken();
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };
}; 