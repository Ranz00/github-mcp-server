# GitHub MCP Server

MCP server en TypeScript que conecta un agente (Antigravity) con la API de GitHub. Expone tools para listar repositorios, crear issues, crear repositorios, crear commits y listar issues.

## Qué resuelve

Un agente puede pedir en lenguaje natural "creá un issue en ..." y el server valida los datos, llama a GitHub y devuelve un DTO chico. No hay que escribir una integración distinta para cada host: cualquier cliente MCP puede usar el server.

## Stack

- TypeScript + Node.js 22.19+
- `@modelcontextprotocol/sdk` (transporte stdio)
- Zod (validación en runtime + JSON Schema)
- Octokit (API de GitHub)
- Vitest (tests)

## Requisitos

- Node.js 22.19 o superior
- npm
- Un token de GitHub con scope `repo`

## Instalación

```bash
git clone https://github.com/Ranz00/github-mcp-server.git
cd github-mcp-server
npm install
```

Creá el `.env` a partir del ejemplo:

```bash
copy .env.example .env
```

En Windows con PowerShell también sirve:

```powershell
Copy-Item .env.example .env
```

Completá el token:

```env
GITHUB_TOKEN=ghp_tu_token
LOG_LEVEL=info
```

> `.env` está en `.gitignore`. Nunca lo subas.

### Crear el token

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic).
2. Generate new token (classic).
3. Marcá el scope `repo`.
4. Copiá el token en `.env`.

Para las 5 tools, el token clásico con `repo` alcanza. Si usás fine-grained, habilitá Contents, Issues y Administration según la operación; para la defensa, el clásico es el camino simple.

## Build y ejecución

```bash
npm run typecheck
npm run build
npm start
```

Para desarrollo:

```bash
npm run dev
```

## Inspector

```bash
npm run build
npm run inspector
```

El Inspector abre el catálogo de tools. Ahí podés probar cada schema sin Antigravity.

## Antigravity

En la configuración MCP de Antigravity, agregá un server con la ruta absoluta al `dist/server.js`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["C:/Users/TU-USUARIO/github-mcp-server/dist/server.js"]
    }
  }
}
```

Reiniciá Antigravity. El server carga el token desde `.env`; no hace falta ponerlo en la configuración.

Si Antigravity no encuentra `node`, usá la ruta absoluta al ejecutable de Node en `command`.

## Tools

| Tool | Qué hace | Parámetros | Prompt ejemplo |
|---|---|---|---|
| `list_repositories` | Lista repos del usuario autenticado | `type`, `sort`, `per_page` | "Listá mis 5 repositorios actualizados más recientemente." |
| `create_issue` | Crea un issue en un repo existente | `owner`, `repo`, `title`, `body?`, `labels?` | "Creá un issue en `Ranz00/mcp-pruebas` con el título 'Bug en el login'." |
| `create_repository` | Crea un repositorio nuevo | `name`, `description?`, `private?` | "Creá un repositorio privado llamado `mcp-demo`." |
| `create_commit` | Crea o actualiza un archivo y lo commitea | `owner`, `repo`, `path`, `content`, `message`, `branch?` | "En `Ranz00/mcp-pruebas`, creá `docs/notas.md` con 'Notas de la defensa' y commitealo." |
| `list_issues` | Lista issues, sin pull requests | `owner`, `repo`, `state?`, `labels?`, `per_page?`, `page?` | "Mostrame los issues abiertos de `Ranz00/mcp-pruebas`." |

## Arquitectura

```text
Antigravity (Host + LLM)
  → MCP Client
    → stdio (JSON-RPC)
      → src/server.ts
        → Zod valida
        → src/tools/*.ts
          → src/github/operations.ts
            → Octokit
              → GitHub API
        ← DTO chico
      ← respuesta JSON-RPC
  ← el LLM responde en lenguaje natural
```

- `src/server.ts`: registra las tools y conecta el transporte stdio.
- `src/schemas/index.ts`: contrato de entrada; Zod valida y genera el JSON Schema.
- `src/tools/*.ts`: una tool por archivo; validan, llaman a `GitHubOperations` y devuelven DTO.
- `src/github/operations.ts`: única capa que conoce Octokit.
- `src/errors/index.ts`: traduce errores a `AppError` con `code`, `action` y `hint`.
- `src/utils/logging.ts`: logs JSON a `stderr`; stdout es solo protocolo.
- `src/utils/retry.ts`: backoff solo para errores transitorios.

## Tests

```bash
npm test
```

Los tests no llaman a GitHub. Inyectan un Octokit falso o un `GitHubOperations` falso. Cubren:

- traducción de 401, 403, 404, 422, 5xx y red;
- validación Zod;
- preflight de Issues deshabilitados;
- commit con `base_tree` y `force: false`;
- tools con GitHub falso;
- input inválido sin llamar a GitHub.

## Errores

| HTTP | Código | ¿Reintentar? |
|---|---|---|
| 401 | `AUTH_ERROR` | No |
| 403 | `FORBIDDEN` o `RATE_LIMIT` | Solo rate limit |
| 404 | `NOT_FOUND` | No |
| 409 | `CONFLICT` | No |
| 410 | `GONE` | No |
| 422 | `VALIDATION_ERROR` | No |
| 5xx | `GITHUB_ERROR` | Sí |
| Red | `NETWORK_ERROR` | Sí |

Las tools devuelven `isError: true` con un JSON que incluye `code`, `message`, `action` y `hint`. El agente puede corregir o reintentar sin tumbar el server.

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `401 Bad credentials` | Token vacío, vencido o mal copiado | Revisá `.env` y reiniciá el server |
| `403 Resource not accessible` | Falta scope `repo` | Creá otro token con `repo` |
| `403 rate limit` | Límite de GitHub | Esperá o usá un token autenticado |
| `404 Not Found` | `owner`, `repo` o `branch` incorrectos | Verificá los nombres |
| `410 Gone` | Issues deshabilitados | Habilitá Issues en el repo |
| `422 Validation Failed` | Nombre o título inválido | Corregí el input |
| El Inspector no conecta | `dist/server.js` no existe | `npm run build` |
| `spawn node ENOENT` | Node no está en PATH | Usá la ruta absoluta de `node` |
| El protocolo se rompe | Un `console.log` en stdout | Logueá con `log()` (stderr) |

## Seguridad

- El token vive en `.env`, nunca en el código ni en Git.
- `.env` está en `.gitignore`.
- Los logs no imprimen el token ni headers.
- Usá el scope mínimo: `repo` para este proyecto.

## Licencia

MIT.