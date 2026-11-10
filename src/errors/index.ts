import { ZodError } from "zod";
import type { ToolResponse } from "../types.js";
import { log } from "../utils/logging.js";

export type ErrorCode =
    | "VALIDATION_ERROR"
    | "AUTH_ERROR"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "GONE"
    | "RATE_LIMIT"
    | "GITHUB_ERROR"
    | "NETWORK_ERROR"
    | "UNKNOWN_ERROR";

export interface AppErrorOptions {
    code: ErrorCode;
    message: string;
    action: string;
    hint?: string;
    retryable?: boolean;
    status?: number;
}

// Un error de dominio: además del mensaje, dice qué puede hacer el agente.
// `retryable` es la señal que usa `withRetry` para decidir si reintenta.
export class AppError extends Error {
    readonly code: ErrorCode;
    readonly action: string;
    readonly hint: string;
    readonly retryable: boolean;
    readonly status?: number;

    constructor(options: AppErrorOptions) {
        super(options.message);
        this.name = "AppError";
        this.code = options.code;
        this.action = options.action;
        this.hint = options.hint ?? "";
        this.retryable = options.retryable ?? false;
        this.status = options.status;
    }

    toJSON(): Record<string, unknown> {
        return {
            code: this.code,
            message: this.message,
            action: this.action,
            hint: this.hint,
            retryable: this.retryable,
            ...(this.status !== undefined ? { status: this.status } : {}),
        };
    }
}

interface OctokitErrorLike {
    status?: number;
    message?: string;
    code?: string;
    response?: {
        headers?: Record<string, string>;
        data?: { message?: string };
    };
}

function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
    if (!headers) return undefined;
    const key = Object.keys(headers).find((header) => header.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
}

// Traduce errores de GitHub, red y Zod a un lenguaje que el agente puede usar.
// El agente no necesita el stack trace: necesita saber qué pasó y qué hacer.
export function toAppError(error: unknown): AppError {
    if (error instanceof AppError) return error;

    if (error instanceof ZodError) {
        const details = error.issues
            .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
            .join("; ");

        return new AppError({
            code: "VALIDATION_ERROR",
            message: "Los datos enviados no son válidos.",
            action: "Corregí los campos indicados y volvé a intentar.",
            hint: details,
            retryable: false,
        });
    }

    const octokitError = (error ?? {}) as OctokitErrorLike;
    const status = octokitError.status;
    const apiMessage =
        octokitError.response?.data?.message ?? octokitError.message ?? "Error desconocido";

    if (status === 401) {
        return new AppError({
            code: "AUTH_ERROR",
            message: "El token de GitHub no es válido o no está configurado.",
            action: "Revisá GITHUB_TOKEN en el archivo .env y reiniciá el server.",
            hint: "GitHub devolvió 401 Unauthorized.",
            retryable: false,
            status,
        });
    }

    if (status === 403) {
        const remaining = getHeader(octokitError.response?.headers, "x-ratelimit-remaining");
        const isRateLimit = remaining === "0" || apiMessage.toLowerCase().includes("rate limit");

        if (isRateLimit) {
            return new AppError({
                code: "RATE_LIMIT",
                message: "Se agotó el límite de requests de GitHub.",
                action: "Esperá unos minutos y volvé a intentar.",
                hint: "GitHub devolvió 403 por rate limit.",
                retryable: true,
                status,
            });
        }

        return new AppError({
            code: "FORBIDDEN",
            message: apiMessage,
            action: "Revisá los permisos del token y del repositorio.",
            hint: "El token necesita el scope repo para leer y escribir.",
            retryable: false,
            status,
        });
    }

    if (status === 404) {
        return new AppError({
            code: "NOT_FOUND",
            message: "No se encontró el repositorio o el recurso solicitado.",
            action: "Verificá owner, repo y branch.",
            hint: "GitHub devolvió 404 Not Found.",
            retryable: false,
            status,
        });
    }

    if (status === 409) {
        return new AppError({
            code: "CONFLICT",
            message: "Hubo un conflicto con el estado actual del repositorio.",
            action: "Actualizá la rama y volvé a intentar.",
            hint: "GitHub devolvió 409 Conflict.",
            retryable: false,
            status,
        });
    }

    if (status === 410) {
        return new AppError({
            code: "GONE",
            message: "El recurso ya no está disponible.",
            action: "Verificá si el repositorio o el issue fueron eliminados.",
            hint: "GitHub devolvió 410 Gone.",
            retryable: false,
            status,
        });
    }

    if (status === 422) {
        return new AppError({
            code: "VALIDATION_ERROR",
            message: "GitHub rechazó los datos enviados.",
            action: "Corregí el nombre, el título o los campos marcados.",
            hint: apiMessage,
            retryable: false,
            status,
        });
    }

    if (status !== undefined && status >= 500) {
        return new AppError({
            code: "GITHUB_ERROR",
            message: "GitHub tuvo un error temporal.",
            action: "Esperá unos segundos y volvé a intentar.",
            hint: `GitHub devolvió ${status}.`,
            retryable: true,
            status,
        });
    }

    if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(octokitError.code ?? "")) {
        return new AppError({
            code: "NETWORK_ERROR",
            message: "No se pudo conectar con GitHub.",
            action: "Revisá tu conexión a internet y volvé a intentar.",
            hint: octokitError.message ?? "Error de red.",
            retryable: true,
        });
    }

    return new AppError({
        code: "UNKNOWN_ERROR",
        message: apiMessage,
        action: "Revisá los logs del server para ver el detalle.",
        hint: "Si el problema persiste, reiniciá el server.",
        retryable: false,
        status,
    });
}

// `fail` conserva el contrato MCP: la tool responde, pero con isError: true.
// Así el LLM recibe una instrucción y el server no se cae.
export function fail(error: unknown, requestId?: string): ToolResponse {
    const appError = toAppError(error);

    log("error", "tool_error", {
        requestId,
        code: appError.code,
        message: appError.message,
        retryable: appError.retryable,
    });

    const payload = { error: appError.toJSON() };

    return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
        isError: true,
    };
}

export function ok(data: unknown): ToolResponse {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}