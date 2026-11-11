import { fail, ok } from "../errors/index.js";
import { ListCommitsSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const listCommitsTool: McpTool = {
    definition: {
        name: "list_commits",
        title: "Listar commits",
        description:
            "Lista los commits recientes de un repositorio. Usala cuando el usuario pida ver la actividad, el historial o los últimos cambios. No modifica nada.",
    },
    schema: ListCommitsSchema,
    async handler(input, context) {
        const parsed = ListCommitsSchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const commits = await context.github.listCommits(parsed.data);
            return ok({ count: commits.length, commits });
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};