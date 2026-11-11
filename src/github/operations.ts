import type { Octokit } from "@octokit/rest";
import { AppError, toAppError } from "../errors/index.js";
import type {
    AddCommentInput,
    CloseIssueInput,
    CreateCommitInput,
    CreateIssueInput,
    CreateRepositoryInput,
    ListCommitsInput,
    ListIssuesInput,
    ListRepositoriesInput,
} from "../schemas/index.js";
import type {
    CommitInfo,
    CommitSummary,
    GitHubOperations,
    IssueCommentInfo,
    IssueInfo,
    RepoInfo,
    RepositoryInfo,
} from "../types.js";
import { withRetry } from "../utils/retry.js";
import { createOctokit } from "./client.js";

// Tipos estructurales mínimos de las respuestas de GitHub.
// No usamos los tipos completos de Octokit porque solo necesitamos estos campos.
interface GitHubRepo {
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    updated_at: string | null;
    default_branch: string;
    has_issues: boolean;
}

interface GitHubIssue {
    number: number;
    title: string;
    state: string;
    html_url: string;
    labels: Array<string | { name?: string | null }>;
    created_at: string;
    pull_request?: unknown;
}

function toRepoInfo(repo: GitHubRepo): RepoInfo {
    return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        language: repo.language,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
    };
}

function toIssueInfo(issue: GitHubIssue): IssueInfo {
    return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        htmlUrl: issue.html_url,
        labels: issue.labels
            .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
            .filter(Boolean),
        createdAt: issue.created_at,
    };
}

function toRepositoryInfo(repo: GitHubRepo): RepositoryInfo {
    return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
    };
}

// La única capa que conoce Octokit.
// Si GitHub cambia, el impacto queda acá; las tools y los tests no se enteran.
export function createGitHubOperations(octokit: Octokit = createOctokit()): GitHubOperations {
    return {
        async listRepositories(input: ListRepositoriesInput): Promise<RepoInfo[]> {
            const { data } = await withRetry(() =>
                octokit.repos.listForAuthenticatedUser({
                    type: input.type,
                    sort: input.sort,
                    per_page: input.per_page,
                }),
            );

            return (data as GitHubRepo[]).map(toRepoInfo);
        },

        async createIssue(input: CreateIssueInput): Promise<IssueInfo> {
            // Preflight: si el repo no existe o tiene Issues deshabilitados,
            // fallamos antes de intentar escribir.
            const repoResponse = await withRetry(() =>
                octokit.repos.get({ owner: input.owner, repo: input.repo }),
            );
            const repo = repoResponse.data as GitHubRepo;

            if (!repo.has_issues) {
                throw new AppError({
                    code: "CONFLICT",
                    message: `El repositorio ${input.owner}/${input.repo} tiene los issues deshabilitados.`,
                    action: "Habilitá Issues en la configuración del repositorio.",
                    hint: "Sin Issues habilitados, GitHub rechaza la creación.",
                    retryable: false,
                });
            }

            const { data } = await octokit.issues.create({
                owner: input.owner,
                repo: input.repo,
                title: input.title,
                body: input.body,
                labels: input.labels,
            });

            return toIssueInfo(data as GitHubIssue);
        },

        async createRepository(input: CreateRepositoryInput): Promise<RepositoryInfo> {
            const { data } = await octokit.repos.createForAuthenticatedUser({
                name: input.name,
                description: input.description,
                private: input.private,
            });

            return toRepositoryInfo(data as GitHubRepo);
        },

        async createCommit(input: CreateCommitInput): Promise<CommitInfo> {
            const repoResponse = await withRetry(() =>
                octokit.repos.get({ owner: input.owner, repo: input.repo }),
            );
            const repo = repoResponse.data as GitHubRepo;
            const branch = input.branch ?? repo.default_branch;

            // Un commit en la API de Git son varios pasos:
            // 1. leer la ref de la rama, 2. leer el commit padre,
            // 3. crear el blob, 4. crear el tree, 5. crear el commit,
            // 6. mover la ref. Si falla el paso 6, no se pierde nada.
            let parentSha: string;
            try {
                const refResponse = await withRetry(() =>
                    octokit.git.getRef({
                        owner: input.owner,
                        repo: input.repo,
                        ref: `heads/${branch}`,
                    }),
                );
                parentSha = refResponse.data.object.sha;
            } catch (error) {
                const appError = toAppError(error);
                if (appError.status === 404) {
                    throw new AppError({
                        code: "NOT_FOUND",
                        message: `No se encontró la rama ${branch}.`,
                        action: "Verificá el nombre de la rama o creala primero.",
                        hint: "GitHub devolvió 404 al buscar la ref.",
                        retryable: false,
                        status: 404,
                    });
                }
                throw appError;
            }

            const parentCommit = await withRetry(() =>
                octokit.git.getCommit({
                    owner: input.owner,
                    repo: input.repo,
                    commit_sha: parentSha,
                }),
            );

            const blob = await octokit.git.createBlob({
                owner: input.owner,
                repo: input.repo,
                content: input.content,
                encoding: "utf-8",
            });

            // `base_tree` conserva los archivos que ya existen.
            // Sin esto, el commit borraría todo lo demás del repositorio.
            const tree = await octokit.git.createTree({
                owner: input.owner,
                repo: input.repo,
                base_tree: parentCommit.data.tree.sha,
                tree: [
                    {
                        path: input.path,
                        mode: "100644",
                        type: "blob",
                        sha: blob.data.sha,
                    },
                ],
            });

            const commit = await octokit.git.createCommit({
                owner: input.owner,
                repo: input.repo,
                message: input.message,
                tree: tree.data.sha,
                parents: [parentSha],
            });

            // `force: false` evita pisar un cambio que haya llegado mientras
            // armábamos el commit. Si la rama se movió, GitHub devuelve 409.
            await octokit.git.updateRef({
                owner: input.owner,
                repo: input.repo,
                ref: `heads/${branch}`,
                sha: commit.data.sha,
                force: false,
            });

            return {
                sha: commit.data.sha,
                htmlUrl: commit.data.html_url,
                message: input.message,
                branch,
                path: input.path,
            };
        },

        async listIssues(input: ListIssuesInput): Promise<IssueInfo[]> {
            const { data } = await withRetry(() =>
                octokit.issues.listForRepo({
                    owner: input.owner,
                    repo: input.repo,
                    state: input.state,
                    labels: input.labels?.join(","),
                    per_page: input.per_page,
                    page: input.page,
                }),
            );

            // El endpoint de issues también devuelve pull requests.
            // El agente pidió issues, así que los filtramos.
            return (data as GitHubIssue[])
                .filter((issue) => !issue.pull_request)
                .map(toIssueInfo);
        },

        async listCommits(input: ListCommitsInput): Promise<CommitSummary[]> {
            const { data } = await withRetry(() =>
                octokit.repos.listCommits({
                    owner: input.owner,
                    repo: input.repo,
                    sha: input.branch,
                    per_page: input.per_page,
                }),
            );

            return data.map((commit) => ({
                sha: commit.sha,
                message: commit.commit.message,
                author: commit.commit.author?.name ?? null,
                date: commit.commit.author?.date ?? null,
                htmlUrl: commit.html_url,
            }));
        },

        async closeIssue(input: CloseIssueInput): Promise<IssueInfo> {
            // Cerrar es un update del estado: GitHub lo trata como edición, no como borrado.
            const { data } = await octokit.issues.update({
                owner: input.owner,
                repo: input.repo,
                issue_number: input.issue_number,
                state: "closed",
            });

            return toIssueInfo(data as GitHubIssue);
        },

        async addComment(input: AddCommentInput): Promise<IssueCommentInfo> {
            const { data } = await octokit.issues.createComment({
                owner: input.owner,
                repo: input.repo,
                issue_number: input.issue_number,
                body: input.body,
            });

            return {
                id: data.id,
                body: data.body ?? "",
                htmlUrl: data.html_url,
                createdAt: data.created_at,
            };
        },
    };
}