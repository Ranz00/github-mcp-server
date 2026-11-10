import { fail, ok } from "../errors/index.js";
import { CreateIssueSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const createIssueTool: McpTool = {
    definition: {
        name: "create_issue",
        title: "Crear issue",
        description:
            "Crea un issue en un repositorio existente. Usala cuando el usuario pida registrar un bug, una tarea o una mejora. Necesitás owner, repo y un título claro; body y labels son opcionales.",
    },
    schema: CreateIssueSchema,
    async handler(input, context) {
        const parsed = CreateIssueSchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const issue = await context.github.createIssue(parsed.data);
            return ok(issue);
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};