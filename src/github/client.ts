import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";

// Cargamos el .env desde la raíz del proyecto, no desde la carpeta actual.
// Antigravity puede lanzar el server desde otra ruta; con una ruta absoluta
// el token se encuentra siempre.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(root, ".env"), quiet: true });

// Octokit se crea una vez y se inyecta en operations.
// Así los tests pueden reemplazarlo por un fake sin tocar las tools.
export function createOctokit(): Octokit {
    return new Octokit({
        auth: process.env.GITHUB_TOKEN, // el token nunca va en el código
        userAgent: "github-mcp-server/1.0.0",
    });
}
