import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, fail, toAppError } from "../src/errors/index";

describe("toAppError", () => {
    it("traduce 401 a AUTH_ERROR", () => {
        const error = toAppError({ status: 401, message: "Bad credentials" });

        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe("AUTH_ERROR");
        expect(error.retryable).toBe(false);
    });

    it("traduce 404 a NOT_FOUND", () => {
        const error = toAppError({ status: 404, message: "Not Found" });

        expect(error.code).toBe("NOT_FOUND");
        expect(error.action).toContain("owner");
    });

    it("marca el rate limit como retryable", () => {
        const error = toAppError({
            status: 403,
            message: "API rate limit exceeded",
            response: { headers: { "x-ratelimit-remaining": "0" } },
        });

        expect(error.code).toBe("RATE_LIMIT");
        expect(error.retryable).toBe(true);
    });

    it("traduce 422 a VALIDATION_ERROR", () => {
        const error = toAppError({ status: 422, message: "Validation Failed" });

        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.retryable).toBe(false);
    });

    it("traduce 500 a GITHUB_ERROR retryable", () => {
        const error = toAppError({ status: 500, message: "Server Error" });

        expect(error.code).toBe("GITHUB_ERROR");
        expect(error.retryable).toBe(true);
    });

    it("traduce errores de red", () => {
        const error = toAppError({ code: "ETIMEDOUT", message: "timeout" });

        expect(error.code).toBe("NETWORK_ERROR");
        expect(error.retryable).toBe(true);
    });

    it("convierte un ZodError en VALIDATION_ERROR", () => {
        const result = z.object({ title: z.string().min(3) }).safeParse({ title: "x" });
        if (result.success) throw new Error("El test esperaba un input inválido");

        const error = toAppError(result.error);

        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.hint).toContain("title");
    });

    it("fail devuelve isError y el código en el texto", () => {
        const response = fail(
            new AppError({
                code: "NOT_FOUND",
                message: "No existe",
                action: "Revisá el repo",
            }),
        );

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("NOT_FOUND");
    });
});