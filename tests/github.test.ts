import type { Octokit } from "@octokit/rest";
import { describe, expect, it, vi } from "vitest";
import { createGitHubOperations } from "../src/github/operations";

const repo = {
    name: "mcp-pruebas",
    full_name: "Ranz00/mcp-pruebas",
    description: "Repo de prueba",
    private: false,
    html_url: "https://github.com/Ranz00/mcp-pruebas",
    language: "TypeScript",
    stargazers_count: 3,
    updated_at: "2026-01-01T00:00:00Z",
    default_branch: "main",
    has_issues: true,
};

const issue = {
    number: 7,
    title: "Bug en el login",
    state: "open",
    html_url: "https://github.com/Ranz00/mcp-pruebas/issues/7",
    labels: ["bug", { name: "prioridad-alta" }],
    created_at: "2026-01-02T00:00:00Z",
};

function fakeOctokit() {
    return {
        repos: {
            listForAuthenticatedUser: vi.fn(),
            get: vi.fn(),
            createForAuthenticatedUser: vi.fn(),
        },
        issues: {
            create: vi.fn(),
            listForRepo: vi.fn(),
        },
        git: {
            getRef: vi.fn(),
            getCommit: vi.fn(),
            createBlob: vi.fn(),
            createTree: vi.fn(),
            createCommit: vi.fn(),
            updateRef: vi.fn(),
        },
    } as unknown as Octokit;
}

describe("GitHubOperations", () => {
    it("lista repositorios y los convierte a DTO", async () => {
        const octokit = fakeOctokit();
        vi.mocked(octokit.repos.listForAuthenticatedUser).mockResolvedValue({ data: [repo] } as never);

        const operations = createGitHubOperations(octokit);
        const result = await operations.listRepositories({
            type: "owner",
            sort: "updated",
            per_page: 5,
        });

        expect(result).toEqual([
            {
                name: "mcp-pruebas",
                fullName: "Ranz00/mcp-pruebas",
                description: "Repo de prueba",
                private: false,
                htmlUrl: "https://github.com/Ranz00/mcp-pruebas",
                language: "TypeScript",
                stars: 3,
                updatedAt: "2026-01-01T00:00:00Z",
            },
        ]);
        expect(octokit.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
            type: "owner",
            sort: "updated",
            per_page: 5,
        });
    });

    it("filtra pull requests de la lista de issues", async () => {
        const octokit = fakeOctokit();
        vi.mocked(octokit.issues.listForRepo).mockResolvedValue({
            data: [issue, { ...issue, number: 8, pull_request: { url: "..." } }],
        } as never);

        const operations = createGitHubOperations(octokit);
        const result = await operations.listIssues({
            owner: "Ranz00",
            repo: "mcp-pruebas",
            state: "open",
            per_page: 30,
            page: 1,
        });

        expect(result).toHaveLength(1);
        expect(result[0].number).toBe(7);
        expect(result[0].labels).toEqual(["bug", "prioridad-alta"]);
    });

    it("no crea un issue si el repo tiene Issues deshabilitados", async () => {
        const octokit = fakeOctokit();
        vi.mocked(octokit.repos.get).mockResolvedValue({
            data: { ...repo, has_issues: false },
        } as never);

        const operations = createGitHubOperations(octokit);

        await expect(
            operations.createIssue({
                owner: "Ranz00",
                repo: "mcp-pruebas",
                title: "Bug en el login",
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        expect(octokit.issues.create).not.toHaveBeenCalled();
    });

    it("crea un issue cuando el preflight pasa", async () => {
        const octokit = fakeOctokit();
        vi.mocked(octokit.repos.get).mockResolvedValue({ data: repo } as never);
        vi.mocked(octokit.issues.create).mockResolvedValue({ data: issue } as never);

        const operations = createGitHubOperations(octokit);
        const result = await operations.createIssue({
            owner: "Ranz00",
            repo: "mcp-pruebas",
            title: "Bug en el login",
            body: "No redirige",
        });

        expect(result.number).toBe(7);
        expect(result.labels).toEqual(["bug", "prioridad-alta"]);
        expect(octokit.issues.create).toHaveBeenCalledWith({
            owner: "Ranz00",
            repo: "mcp-pruebas",
            title: "Bug en el login",
            body: "No redirige",
            labels: undefined,
        });
    });

    it("crea un commit con base_tree y force false", async () => {
        const octokit = fakeOctokit();
        vi.mocked(octokit.repos.get).mockResolvedValue({ data: repo } as never);
        vi.mocked(octokit.git.getRef).mockResolvedValue({
            data: { object: { sha: "parent-sha" } },
        } as never);
        vi.mocked(octokit.git.getCommit).mockResolvedValue({
            data: { tree: { sha: "parent-tree" } },
        } as never);
        vi.mocked(octokit.git.createBlob).mockResolvedValue({
            data: { sha: "blob-sha" },
        } as never);
        vi.mocked(octokit.git.createTree).mockResolvedValue({
            data: { sha: "tree-sha" },
        } as never);
        vi.mocked(octokit.git.createCommit).mockResolvedValue({
            data: { sha: "commit-sha", html_url: "https://github.com/commit/commit-sha" },
        } as never);
        vi.mocked(octokit.git.updateRef).mockResolvedValue({ data: {} } as never);

        const operations = createGitHubOperations(octokit);
        const result = await operations.createCommit({
            owner: "Ranz00",
            repo: "mcp-pruebas",
            path: "docs/notas.md",
            content: "Notas de la defensa",
            message: "docs: agrega notas",
        });

        expect(result).toEqual({
            sha: "commit-sha",
            htmlUrl: "https://github.com/commit/commit-sha",
            message: "docs: agrega notas",
            branch: "main",
            path: "docs/notas.md",
        });
        expect(octokit.git.createTree).toHaveBeenCalledWith(
            expect.objectContaining({
                base_tree: "parent-tree",
                tree: [
                    expect.objectContaining({
                        path: "docs/notas.md",
                        sha: "blob-sha",
                    }),
                ],
            }),
        );
        expect(octokit.git.updateRef).toHaveBeenCalledWith(
            expect.objectContaining({
                ref: "heads/main",
                sha: "commit-sha",
                force: false,
            }),
        );
    });

    it("crea un repositorio y devuelve el DTO", async () => {
        const octokit = fakeOctokit();
        vi.mocked(octokit.repos.createForAuthenticatedUser).mockResolvedValue({
            data: repo,
        } as never);

        const operations = createGitHubOperations(octokit);
        const result = await operations.createRepository({
            name: "mcp-pruebas",
            private: false,
        });

        expect(result.defaultBranch).toBe("main");
        expect(result.fullName).toBe("Ranz00/mcp-pruebas");
    });
});