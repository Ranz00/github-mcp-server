import { fail, ok } from "../errors/index.js";
import { CloseIssueSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const closeIssueTool: McpTool = {
    definition: {
        name: "close_issue",
        title: "Cerrar issue",
        description:
            "Cierra un issue existente. Usala cuando el usuario diga que un bug está resuelto o que una tarea terminó. Necesitás owner, repo y el número del issue.",
    },
    schema: CloseIssueSchema,
    async handler(input, context) {
        const parsed = CloseIssueSchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const issue = await context.github.closeIssue(parsed.data);
            return ok(issue);
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};