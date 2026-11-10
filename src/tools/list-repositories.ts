import { fail, ok } from "../errors/index.js";
import { ListRepositoriesSchema } from "../schemas/index.js";
import type { McpTool } from "../types.js";

export const listRepositoriesTool: McpTool = {
    definition: {
        name: "list_repositories",
        title: "Listar repositorios",
        description:
            "Lista los repositorios del usuario autenticado. Usala cuando el usuario pida ver sus repos, los más recientes o filtrar por visibilidad. No crea ni modifica nada.",
    },
    schema: ListRepositoriesSchema,
    async handler(input, context) {
        // El SDK valida antes de llamar al handler, pero repetimos la validación
        // para que la tool sea segura si se invoca directo desde un test.
        const parsed = ListRepositoriesSchema.safeParse(input);
        if (!parsed.success) return fail(parsed.error, context.requestId);

        try {
            const repositories = await context.github.listRepositories(parsed.data);
            return ok({ count: repositories.length, repositories });
        } catch (error) {
            return fail(error, context.requestId);
        }
    },
};