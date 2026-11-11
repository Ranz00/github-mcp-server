import { describe, expect, it } from "vitest";
import { healthTool } from "../src/tools/health";
import type { GitHubOperations } from "../src/types";

const github = {} as GitHubOperations;

describe("health", () => {
    it("devuelve estado sin llamar a GitHub", async () => {
        const result = await healthTool.handler({}, { github, requestId: "health-test" });
        const payload = JSON.parse(result.content[0].text);

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe("ok");
        expect(payload.uptimeSeconds).toBeGreaterThanOrEqual(0);
        expect(payload.requestId).toBe("health-test");
    });
});