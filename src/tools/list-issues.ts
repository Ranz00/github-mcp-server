import { fail, ok } from "../errors/index.js";
import { ListIssuesSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const listIssuesTool: McpTool = {
    definition: {
        name: "list_issues",
        title: "Listar issues",
        description:
            "Lista issues de un repositorio. Usala para consultar bugs o tareas. No devuelve pull requests. state por defecto es open; labels filtra por etiquetas.",
    },
    schema: ListIssuesSchema,
    async handler(input, context) {
        const parsed = ListIssuesSchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const issues = await context.github.listIssues(parsed.data);
            return ok({ count: issues.length, issues });
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};