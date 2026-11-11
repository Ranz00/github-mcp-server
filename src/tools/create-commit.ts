import { fail, ok } from "../errors/index.js";
import { CreateCommitSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const createCommitTool: McpTool = {
    definition: {
        name: "create_commit",
        title: "Crear commit",
        description:
            "Crea o actualiza un archivo en un repositorio y lo commitea en una rama. Usala cuando el usuario pida guardar contenido en GitHub. path no puede ser absoluto ni contener `..`. Si no se indica branch, usa la rama principal.",
    },
    schema: CreateCommitSchema,
    async handler(input, context) {
        const parsed = CreateCommitSchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const commit = await context.github.createCommit(parsed.data);
            return ok(commit);
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};