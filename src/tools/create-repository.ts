import { fail, ok } from "../errors/index.js";
import { CreateRepositorySchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const createRepositoryTool: McpTool = {
    definition: {
        name: "create_repository",
        title: "Crear repositorio",
        description:
            "Crea un repositorio nuevo en la cuenta autenticada. Usala solo cuando el usuario pida explícitamente crear un repo. El nombre debe tener entre 3 y 100 caracteres y solo admite letras, números y guiones.",
    },
    schema: CreateRepositorySchema,
    async handler(input, context) {
        const parsed = CreateRepositorySchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const repository = await context.github.createRepository(parsed.data);
            return ok(repository);
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};