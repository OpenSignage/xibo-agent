export interface MCPConfig {
  servers: Record<string, {
    command: string;
    args: string[];
  }>;
}

export class MCPClient {
  private config: MCPConfig;

  constructor(config: MCPConfig) {
    this.config = config;
  }

  async getTools() {
    const tools: Record<string, any> = {};
    
    for (const [serverName, config] of Object.entries(this.config.servers)) {
      tools[serverName] = {
        type: 'provider-defined',
        id: `${serverName}.mcp`,
        parameters: {},
        description: `${serverName} MCP tool`
      };
    }
    
    return tools;
  }
} 