import { toAppError } from "../errors/index.js";
import { log } from "./logging.js";

export interface RetryOptions {
    retries?: number;
    baseDelayMs?: number;
}

// Reintenta solo errores transitorios (5xx, red o rate limit).
// No se usa para escrituras: reintentar un create podría duplicar un issue
// o un repositorio.
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 300;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const appError = toAppError(error);

            if (!appError.retryable || attempt === retries) throw appError;

            const delayMs = baseDelayMs * 2 ** attempt;
            log("warn", "retrying", {
                attempt: attempt + 1,
                delayMs,
                code: appError.code,
            });

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    throw toAppError(lastError);
}