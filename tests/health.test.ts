import { describe, expect, it } from "vitest";
import { healthTool } from "../src/tools/health.js";
import type { GitHubOperations, ToolContext } from "../src/types.js";

function fakeGithub(): GitHubOperations {
    return {
        listRepositories: async () => [],
        createIssue: async () => ({} as any),
        createRepository: async () => ({} as any),
        createCommit: async () => ({} as any),
        listIssues: async () => [],
    };
}

function context(github: GitHubOperations): ToolContext {
    return { github, requestId: "req-123" };
}

describe("health tool", () => {
    it("devuelve estado ok, uptime y requestId", async () => {
        const github = fakeGithub();
        const result = await healthTool.handler({}, context(github));
        const payload = JSON.parse(result.content[0].text as string);

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe("ok");
        expect(payload.requestId).toBe("req-123");
        expect(typeof payload.uptimeSeconds).toBe("number");
        expect(typeof payload.timestamp).toBe("string");
    });
});
