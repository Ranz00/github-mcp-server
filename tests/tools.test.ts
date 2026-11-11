import { describe, expect, it, vi } from "vitest";
import { AppError } from "../src/errors/index";
import { createCommitTool } from "../src/tools/create-commit";
import { createIssueTool } from "../src/tools/create-issue";
import { createRepositoryTool } from "../src/tools/create-repository";
import { listIssuesTool } from "../src/tools/list-issues";
import { listRepositoriesTool } from "../src/tools/list-repositories";
import type { GitHubOperations, ToolContext } from "../src/types";
import { addCommentTool } from "../src/tools/add-comment";
import { closeIssueTool } from "../src/tools/close-issue";
import { listCommitsTool } from "../src/tools/list-commits";


function fakeGithub(): GitHubOperations {
    return {
        listRepositories: vi.fn(),
        createIssue: vi.fn(),
        createRepository: vi.fn(),
        createCommit: vi.fn(),
        listIssues: vi.fn(),
        listCommits: vi.fn(),
        closeIssue: vi.fn(),
        addComment: vi.fn(),
    };
}

function context(github: GitHubOperations): ToolContext {
    return { github, requestId: "test-request" };
}

const repoInfo = {
    name: "mcp-pruebas",
    fullName: "Ranz00/mcp-pruebas",
    description: "Repo de prueba",
    private: false,
    htmlUrl: "https://github.com/Ranz00/mcp-pruebas",
    language: "TypeScript",
    stars: 3,
    updatedAt: "2026-01-01T00:00:00Z",
};

const issueInfo = {
    number: 7,
    title: "Bug en el login",
    state: "open",
    htmlUrl: "https://github.com/Ranz00/mcp-pruebas/issues/7",
    labels: ["bug"],
    createdAt: "2026-01-02T00:00:00Z",
};

describe("tools MCP", () => {
    it("list_repositories devuelve count y DTOs", async () => {
        const github = fakeGithub();
        vi.mocked(github.listRepositories).mockResolvedValue([repoInfo]);

        const result = await listRepositoriesTool.handler({}, context(github));
        const payload = JSON.parse(result.content[0].text);

        expect(result.isError).toBeUndefined();
        expect(payload.count).toBe(1);
        expect(payload.repositories[0].fullName).toBe("Ranz00/mcp-pruebas");
    });

    it("create_issue devuelve el issue creado", async () => {
        const github = fakeGithub();
        vi.mocked(github.createIssue).mockResolvedValue(issueInfo);

        const result = await createIssueTool.handler(
            { owner: "Ranz00", repo: "mcp-pruebas", title: "Bug en el login" },
            context(github),
        );

        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text).number).toBe(7);
    });

    it("create_issue rechaza un título corto sin llamar a GitHub", async () => {
        const github = fakeGithub();

        const result = await createIssueTool.handler(
            { owner: "Ranz00", repo: "mcp-pruebas", title: "x" },
            context(github),
        );

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("VALIDATION_ERROR");
        expect(github.createIssue).not.toHaveBeenCalled();
    });

    it("create_repository traduce un error de GitHub", async () => {
        const github = fakeGithub();
        vi.mocked(github.createRepository).mockRejectedValue(
            new AppError({
                code: "FORBIDDEN",
                message: "Sin permisos",
                action: "Revisá el token",
            }),
        );

        const result = await createRepositoryTool.handler({ name: "nuevo-repo" }, context(github));

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("FORBIDDEN");
    });

    it("create_commit devuelve sha y branch", async () => {
        const github = fakeGithub();
        vi.mocked(github.createCommit).mockResolvedValue({
            sha: "abc123",
            htmlUrl: "https://github.com/commit/abc123",
            message: "docs: notas",
            branch: "main",
            path: "docs/notas.md",
        });

        const result = await createCommitTool.handler(
            {
                owner: "Ranz00",
                repo: "mcp-pruebas",
                path: "docs/notas.md",
                content: "Notas",
                message: "docs: notas",
            },
            context(github),
        );

        const payload = JSON.parse(result.content[0].text);
        expect(payload.sha).toBe("abc123");
        expect(payload.branch).toBe("main");
    });

    it("list_issues devuelve count e issues", async () => {
        const github = fakeGithub();
        vi.mocked(github.listIssues).mockResolvedValue([issueInfo]);

        const result = await listIssuesTool.handler(
            { owner: "Ranz00", repo: "mcp-pruebas" },
            context(github),
        );

        const payload = JSON.parse(result.content[0].text);
        expect(payload.count).toBe(1);
        expect(payload.issues[0].number).toBe(7);
    });
    it("list_commits devuelve count y commits", async () => {
        const github = fakeGithub();
        vi.mocked(github.listCommits).mockResolvedValue([
            {
                sha: "abc123",
                message: "feat: algo",
                author: "Ranz00",
                date: "2026-01-03T00:00:00Z",
                htmlUrl: "https://github.com/commit/abc123",
            },
        ]);

        const result = await listCommitsTool.handler(
            { owner: "Ranz00", repo: "mcp-pruebas" },
            context(github),
        );
        const payload = JSON.parse(result.content[0].text);

        expect(payload.count).toBe(1);
        expect(payload.commits[0].sha).toBe("abc123");
    });

    it("close_issue devuelve el issue cerrado", async () => {
        const github = fakeGithub();
        vi.mocked(github.closeIssue).mockResolvedValue({ ...issueInfo, state: "closed" });

        const result = await closeIssueTool.handler(
            { owner: "Ranz00", repo: "mcp-pruebas", issue_number: 7 },
            context(github),
        );
        const payload = JSON.parse(result.content[0].text);

        expect(result.isError).toBeUndefined();
        expect(payload.state).toBe("closed");
    });

    it("add_comment_to_issue devuelve el comentario", async () => {
        const github = fakeGithub();
        vi.mocked(github.addComment).mockResolvedValue({
            id: 1,
            body: "Listo",
            htmlUrl: "https://github.com/comment/1",
            createdAt: "2026-01-04T00:00:00Z",
        });

        const result = await addCommentTool.handler(
            { owner: "Ranz00", repo: "mcp-pruebas", issue_number: 7, body: "Listo" },
            context(github),
        );

        expect(JSON.parse(result.content[0].text).body).toBe("Listo");
    });

    it("add_comment_to_issue rechaza un body vacío", async () => {
        const github = fakeGithub();

        const result = await addCommentTool.handler(
            { owner: "Ranz00", repo: "mcp-pruebas", issue_number: 7, body: "  " },
            context(github),
        );

        expect(result.isError).toBe(true);
        expect(github.addComment).not.toHaveBeenCalled();
    });
});