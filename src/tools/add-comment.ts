import { fail, ok } from "../errors/index.js";
import { AddCommentSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const addCommentTool: McpTool = {
    definition: {
        name: "add_comment_to_issue",
        title: "Comentar un issue",
        description:
            "Agrega un comentario a un issue existente. Usala para dejar avances, preguntas o el resultado de una revisión. Necesitás owner, repo, el número del issue y el texto.",
    },
    schema: AddCommentSchema,
    async handler(input, context) {
        const parsed = AddCommentSchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const comment = await context.github.addComment(parsed.data);
            return ok(comment);
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};