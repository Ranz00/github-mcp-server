import { writeFileSync } from "node:fs";
import { toJsonSchema } from "../src/schemas/index.js";
import type { McpTool } from "../src/types.js";
import { addCommentTool } from "../src/tools/add-comment.js";
import { closeIssueTool } from "../src/tools/close-issue.js";
import { createCommitTool } from "../src/tools/create-commit.js";
import { createIssueTool } from "../src/tools/create-issue.js";
import { createRepositoryTool } from "../src/tools/create-repository.js";
import { healthTool } from "../src/tools/health.js";
import { listCommitsTool } from "../src/tools/list-commits.js";
import { listIssuesTool } from "../src/tools/list-issues.js";
import { listRepositoriesTool } from "../src/tools/list-repositories.js";

const tools: McpTool[] = [
    listRepositoriesTool,
    createIssueTool,
    createRepositoryTool,
    createCommitTool,
    listIssuesTool,
    listCommitsTool,
    closeIssueTool,
    addCommentTool,
    healthTool,
];

const lines: string[] = [
    "# Tools del MCP Server",
    "",
    "> Generado automáticamente desde los schemas de Zod. No editar a mano.",
    "",
];

for (const tool of tools) {
    const schema = toJsonSchema(tool.schema) as {
        properties?: Record<string, { type?: string; description?: string }>;
        required?: string[];
    };
    const props = schema.properties ?? {};
    const required = schema.required ?? [];

    lines.push(`## \`${tool.definition.name}\``, "", tool.definition.description, "");
    lines.push("| Parámetro | Tipo | Obligatorio | Descripción |", "|---|---|---|---|");

    for (const [name, prop] of Object.entries(props)) {
        const req = required.includes(name) ? "sí" : "no";
        lines.push(`| \`${name}\` | ${prop.type ?? "-"} | ${req} | ${prop.description ?? ""} |`);
    }

    if (Object.keys(props).length === 0) lines.push("| — | — | — | Sin parámetros |");
    lines.push("");
}

writeFileSync("TOOLS.md", lines.join("\n"), "utf-8");
console.log(`TOOLS.md generado con ${tools.length} tools.`);