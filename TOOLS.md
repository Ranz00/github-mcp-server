# Tools del MCP Server

> Generado automáticamente desde los schemas de Zod. No editar a mano.

## `list_repositories`

Lista los repositorios del usuario autenticado. Usala cuando el usuario pida ver sus repos, los más recientes o filtrar por visibilidad. No crea ni modifica nada.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `type` | string | no | Qué repos listar: all, owner, public, private o member |
| `sort` | string | no | Orden: created, updated, pushed o full_name |
| `per_page` | integer | no | Cantidad de repos por página (1-100) |

## `create_issue`

Crea un issue en un repositorio existente. Usala cuando el usuario pida registrar un bug, una tarea o una mejora. Necesitás owner, repo y un título claro; body y labels son opcionales.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | sí | Dueño del repositorio |
| `repo` | string | sí | Nombre del repositorio |
| `title` | string | sí | Título del issue |
| `body` | string | no | Descripción del issue |
| `labels` | array | no | Etiquetas a aplicar (máximo 10) |

## `create_repository`

Crea un repositorio nuevo en la cuenta autenticada. Usala solo cuando el usuario pida explícitamente crear un repo. El nombre debe tener entre 3 y 100 caracteres y solo admite letras, números y guiones.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `name` | string | sí | Nombre del repositorio |
| `description` | string | no | Descripción breve |
| `private` | boolean | no | true si el repo debe ser privado |

## `create_commit`

Crea o actualiza un archivo en un repositorio y lo commitea en una rama. Usala cuando el usuario pida guardar contenido en GitHub. path no puede ser absoluto ni contener `..`. Si no se indica branch, usa la rama principal.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | sí | Dueño del repositorio |
| `repo` | string | sí | Nombre del repositorio |
| `path` | string | sí | Ruta del archivo, por ejemplo docs/notas.md |
| `content` | string | sí | Contenido del archivo |
| `message` | string | sí | Mensaje del commit |
| `branch` | string | no | Rama donde commitear; por defecto la principal |

## `list_issues`

Lista issues de un repositorio. Usala para consultar bugs o tareas. No devuelve pull requests. state por defecto es open; labels filtra por etiquetas.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | sí | Dueño del repositorio |
| `repo` | string | sí | Nombre del repositorio |
| `state` | string | no | Estado: open, closed o all |
| `labels` | array | no | Etiquetas para filtrar |
| `per_page` | integer | no | Cantidad por página (1-100) |
| `page` | integer | no | Número de página |

## `list_commits`

Lista los commits recientes de un repositorio. Usala cuando el usuario pida ver la actividad, el historial o los últimos cambios. No modifica nada.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | sí | Dueño del repositorio |
| `repo` | string | sí | Nombre del repositorio |
| `branch` | string | no | Rama a revisar; por defecto la principal |
| `per_page` | integer | no | Cantidad de commits (1-100) |

## `close_issue`

Cierra un issue existente. Usala cuando el usuario diga que un bug está resuelto o que una tarea terminó. Necesitás owner, repo y el número del issue.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | sí | Dueño del repositorio |
| `repo` | string | sí | Nombre del repositorio |
| `issue_number` | integer | sí | Número del issue |

## `add_comment_to_issue`

Agrega un comentario a un issue existente. Usala para dejar avances, preguntas o el resultado de una revisión. Necesitás owner, repo, el número del issue y el texto.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | sí | Dueño del repositorio |
| `repo` | string | sí | Nombre del repositorio |
| `issue_number` | integer | sí | Número del issue |
| `body` | string | sí | Texto del comentario |

## `health`

Verifica el estado del servidor MCP y sus métricas básicas (uptime, timestamp y requestId).

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| — | — | — | Sin parámetros |
