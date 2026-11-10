type LogLevel = "debug" | "info" | "warn" | "error";

const priorities: Record<LogLevel | "silent", number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};

// stdout es el canal de JSON-RPC: si escribimos un log ahí, rompemos el
// protocolo. Por eso todos los logs van a stderr.
export function log(level: LogLevel, message: string, data: Record<string, unknown> = {}): void {
    const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
    const threshold = priorities[configured as keyof typeof priorities] ?? priorities.info;
    if (priorities[level] < threshold) return;

    console.error(
        JSON.stringify({
            time: new Date().toISOString(),
            level,
            message,
            ...data,
        }),
    );
}