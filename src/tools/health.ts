import { ok } from "../errors/index.js";
import { HealthSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const healthTool: McpTool = {
    definition: {
        name: "health",
        title: "Estado del Servidor",
        description:
            "Verifica el estado del servidor MCP y sus métricas básicas (uptime, timestamp y requestId).",
    },
    schema: HealthSchema,
    async handler(_input, context) {
        return ok({
            status: "ok",
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            requestId: context.requestId ?? "unknown",
        });
    },
};
