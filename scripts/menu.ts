import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const rl = createInterface({ input: process.stdin, output: process.stdout });

// Mismo server que usa Antigravity, con este menú como cliente.
const client = new Client({ name: "menu", version: "1.0.0" });
const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("dist/server.js")],
    stderr: "inherit", // deja ver requestId y durationMs
});

await client.connect(transport);

const { tools } = await client.listTools();

// Modo directo (sin prompts): npm run menu -- --tool health --args '{}'
const argv = process.argv.slice(2);
const toolFlag = argv.indexOf("--tool");
if (toolFlag !== -1) {
    const argsFlag = argv.indexOf("--args");
    const args = argsFlag !== -1 ? JSON.parse(argv[argsFlag + 1] ?? "{}") : {};
    const result = await client.callTool({ name: argv[toolFlag + 1] ?? "", arguments: args });
    console.log(JSON.stringify(result.content, null, 2));
    await client.close();
    process.exit(0);
}

type Property = { type?: string; description?: string; default?: unknown };
type Schema = { properties?: Record<string, Property>; required?: string[] };

async function ask(text: string): Promise<string | null> {
    try {
        return (await rl.question(text)).trim();
    } catch {
        return null; // stdin cerrado (EOF)
    }
}

let running = true;

while (running) {
    console.log("\nTools disponibles:");
    tools.forEach((tool, index) => console.log(`  ${index + 1}. ${tool.name}`));
    console.log("  0. Salir");

    const choice = await ask("\n¿Qué tool querés usar ahora? ");
    if (choice === null || choice === "0") break;

    const tool = tools[Number(choice) - 1];
    if (!tool) {
        console.log("Opción inválida.");
        continue;
    }

    const schema = (tool.inputSchema ?? {}) as Schema;
    const props = schema.properties ?? {};
    const required = schema.required ?? [];
    const args: Record<string, unknown> = {};

    console.log(`\n${tool.name}: ${tool.description ?? ""}`);

    for (const [name, prop] of Object.entries(props)) {
        const isRequired = required.includes(name);
        const hint = prop.description ? ` — ${prop.description}` : "";
        const def = prop.default !== undefined ? ` [${JSON.stringify(prop.default)}]` : "";
        const raw = await ask(`  ${name}${isRequired ? " *" : ""}${hint}${def}: `);

        if (raw === null) {
            running = false;
            break;
        }

        if (raw === "") {
            if (prop.default !== undefined) args[name] = prop.default;
            else if (isRequired) console.log(`  ! ${name} es obligatorio`);
            continue;
        }

        args[name] =
            prop.type === "number"
                ? Number(raw)
                : prop.type === "boolean"
                  ? raw === "true"
                  : prop.type === "array"
                    ? raw.split(",").map((item) => item.trim())
                    : raw;
    }

    if (!running) break;

    const result = await client.callTool({ name: tool.name, arguments: args });
    console.log("\n" + JSON.stringify(result.content, null, 2));
}

await client.close();
try {
    rl.close();
} catch {
    // stdin ya cerrado: no hay nada que cerrar
}
