import { z } from "zod";

// Los schemas son el contrato de entrada de cada tool:
// Zod valida en runtime, TypeScript infiere el tipo y `toJsonSchema`
// genera el JSON Schema que lee el LLM en `tools/list`.

// Listar repositorios del usuario autenticado.
// `type` y `sort` son enums porque GitHub solo acepta esos valores.
// `per_page` va de 1 a 100: es el límite real de la API.
export const ListRepositoriesSchema = z.object({
    type: z
        .enum(["all", "owner", "public", "private", "member"])
        .default("owner")
        .describe("Qué repos listar: all, owner, public, private o member"),
    sort: z
        .enum(["created", "updated", "pushed", "full_name"])
        .default("updated")
        .describe("Orden de los resultados"),
    per_page: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(30)
        .describe("Cantidad de repos por página (1-100)"),
});

// Crear un issue.
// `title` y `body` respetan los límites de GitHub.
// `labels` se limita a 10 para no mandar un request enorme.
export const CreateIssueSchema = z.object({
    owner: z.string().min(1).describe("Dueño del repositorio"),
    repo: z.string().min(1).describe("Nombre del repositorio"),
    title: z.string().trim().min(3).max(256).describe("Título del issue"),
    body: z.string().max(65_000).optional().describe("Descripción del issue"),
    labels: z.array(z.string()).max(10).optional().describe("Etiquetas del issue"),
});

// Crear un commit con un archivo.
// `path` se valida para que no sea absoluto ni pueda salir de la carpeta
// con `..`. `branch` es opcional: si no viene, se usa la rama principal.
export const CreateCommitSchema = z.object({
    owner: z.string().min(1).describe("Dueño del repositorio"),
    repo: z.string().min(1).describe("Nombre del repositorio"),
    path: z
        .string()
        .min(1)
        .refine(
            (p) => !p.startsWith("/") && !p.includes(".."),
            "path no puede empezar con / ni contener ..",
        )
        .describe("Ruta del archivo, por ejemplo docs/notas.md"),
    content: z.string().describe("Contenido del archivo"),
    message: z.string().trim().min(1).max(500).describe("Mensaje del commit"),
    branch: z.string().optional().describe("Rama donde commitear; por defecto la principal"),
});

// Crear un repositorio.
// `name` sigue la regla de GitHub: 3-100 caracteres, letras, números y guiones.
// `private` tiene default false para que el LLM no tenga que enviarlo siempre.
export const CreateRepositorySchema = z.object({
    name: z
        .string()
        .trim()
        .min(3)
        .max(100)
        .regex(/^[A-Za-z0-9-]+$/, "name solo admite letras, números y guiones")
        .describe("Nombre del repositorio"),
    description: z.string().max(350).optional().describe("Descripción breve"),
    private: z.boolean().default(false).describe("true si el repo debe ser privado"),
});

// Listar issues.
// `state` default "open" porque es lo que el agente espera si no aclara.
// `labels` filtra por etiquetas y la paginación evita traer todo de golpe.
export const ListIssuesSchema = z.object({
    owner: z.string().min(1).describe("Dueño del repositorio"),
    repo: z.string().min(1).describe("Nombre del repositorio"),
    state: z
        .enum(["open", "closed", "all"])
        .default("open")
        .describe("Estado de los issues"),
    labels: z.array(z.string()).max(10).optional().describe("Filtrar por etiquetas"),
    per_page: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(30)
        .describe("Cantidad por página"),
    page: z.number().int().min(1).default(1).describe("Número de página"),
});

export const HealthSchema = z.object({});

// Listar commits de una rama.
// `branch` es opcional: si no viene, GitHub usa la rama por defecto.
export const ListCommitsSchema = z.object({
    owner: z.string().min(1).describe("Dueño del repositorio"),
    repo: z.string().min(1).describe("Nombre del repositorio"),
    branch: z.string().optional().describe("Rama a revisar; por defecto la principal"),
    per_page: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe("Cantidad de commits (1-100)"),
});

// Cerrar un issue.
// `issue_number` es el número de la URL del issue, no un id interno.
export const CloseIssueSchema = z.object({
    owner: z.string().min(1).describe("Dueño del repositorio"),
    repo: z.string().min(1).describe("Nombre del repositorio"),
    issue_number: z.number().int().min(1).describe("Número del issue"),
});

// Comentar un issue.
// `trim` + `min(1)` evita que un comentario vacío llegue a GitHub.
export const AddCommentSchema = z.object({
    owner: z.string().min(1).describe("Dueño del repositorio"),
    repo: z.string().min(1).describe("Nombre del repositorio"),
    issue_number: z.number().int().min(1).describe("Número del issue"),
    body: z.string().trim().min(1).max(65_000).describe("Texto del comentario"),
});

// Tipos inferidos: no escribimos interfaces aparte.
// Si cambia el schema, el tipo cambia solo.
export type ListCommitsInput = z.infer<typeof ListCommitsSchema>;
export type CloseIssueInput = z.infer<typeof CloseIssueSchema>;
export type AddCommentInput = z.infer<typeof AddCommentSchema>;
export type ListRepositoriesInput = z.infer<typeof ListRepositoriesSchema>;
export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;
export type CreateCommitInput = z.infer<typeof CreateCommitSchema>;
export type CreateRepositoryInput = z.infer<typeof CreateRepositorySchema>; export type ListIssuesInput = z.infer<typeof ListIssuesSchema>;
export type HealthInput = z.infer<typeof HealthSchema>;

// Convierte el schema de Zod al JSON Schema que ve el LLM.
// `io: "input"` hace que los defaults no aparezcan como obligatorios.
// Quitamos `$schema` porque MCP no lo necesita y agrega ruido.
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
    const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
    delete json.$schema;
    return json;
}
