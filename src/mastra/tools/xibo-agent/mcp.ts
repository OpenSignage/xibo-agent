import { MCPClient } from "./MCPClient";
import type { MCPConfig } from "./MCPClient";
import config from './config.json' assert { type: "json" };

const mcp = new MCPClient({
  servers: config.mcpServers
});

export const getMCPTools = async () => {
  return await mcp.getTools();
};

export { mcp };
