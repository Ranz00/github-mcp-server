import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fail } from "./errors/index.js";
import { createGitHubOperations } from "./github/operations.js";
import { createCommitTool } from "./tools/create-commit.js";
import { createIssueTool } from "./tools/create-issue.js";
import { createRepositoryTool } from "./tools/create-repository.js";
import { listIssuesTool } from "./tools/list-issues.js";
import { listRepositoriesTool } from "./tools/list-repositories.js";
import type { McpTool } from "./types.js";
import { log } from "./utils/logging.js";

const VERSION = "1.0.0";
const server = new McpServer({ name: "github-mcp-server", version: VERSION });
const github = createGitHubOperations();

const tools: McpTool[] = [
    listRepositoriesTool,
    createIssueTool,
    createRepositoryTool,
    createCommitTool,
    listIssuesTool,
];

for (const tool of tools) {
    server.registerTool(
        tool.definition.name,
        {
            title: tool.definition.title,
            description: tool.definition.description,
            inputSchema: tool.schema,
        },
        async (input) => {
            log("info", "tool_call", { tool: tool.definition.name });

            try {
                return await tool.handler(input, { github });
            } catch (error) {
                return fail(error);
            }
        },
    );
}

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("info", "server_started", {
        name: "github-mcp-server",
        version: VERSION,
    });
}

main().catch((error: unknown) => {
    log("error", "server_fatal", {
        message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
});