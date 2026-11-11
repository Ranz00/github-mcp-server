import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodType } from "zod";
import type {
    CreateCommitInput,
    CreateIssueInput,
    CreateRepositoryInput,
    ListIssuesInput,
    ListRepositoriesInput,
    AddCommentInput,
    CloseIssueInput,
    ListCommitsInput,
} from "./schemas/index.js";

// DTO = Data Transfer Object.
// No devolvemos la respuesta cruda de GitHub: tiene decenas de campos que el
// agente no necesita. Estos objetos son chicos, estables y fáciles de testear.
export interface RepoInfo {
    name: string;
    fullName: string;
    description: string | null;
    private: boolean;
    htmlUrl: string;
    language: string | null;
    stars: number;
    updatedAt: string | null;
}

export interface IssueInfo {
    number: number;
    title: string;
    state: string;
    htmlUrl: string;
    labels: string[];
    createdAt: string;
}

export interface RepositoryInfo {
    name: string;
    fullName: string;
    description: string | null;
    private: boolean;
    htmlUrl: string;
    defaultBranch: string;
}

export interface CommitInfo {
    sha: string;
    htmlUrl: string;
    message: string;
    branch: string;
    path: string;
}

export interface CommitSummary {
    sha: string;
    message: string;
    author: string | null;
    date: string | null;
    htmlUrl: string;
}

export interface IssueCommentInfo {
    id: number;
    body: string;
    htmlUrl: string;
    createdAt: string;
}

// Contrato entre las tools y GitHub.
// Las tools dependen de esta interfaz, no de Octokit: en los tests inyectamos
// un objeto falso y no hacemos ninguna llamada real a GitHub.
export interface GitHubOperations {
    listRepositories(input: ListRepositoriesInput): Promise<RepoInfo[]>;
    createIssue(input: CreateIssueInput): Promise<IssueInfo>;
    createRepository(input: CreateRepositoryInput): Promise<RepositoryInfo>;
    createCommit(input: CreateCommitInput): Promise<CommitInfo>;
    listIssues(input: ListIssuesInput): Promise<IssueInfo[]>;
    listCommits(input: ListCommitsInput): Promise<CommitSummary[]>;
    closeIssue(input: CloseIssueInput): Promise<IssueInfo>;
    addComment(input: AddCommentInput): Promise<IssueCommentInfo>;
}

export interface McpToolDefinition {
    name: string;
    title: string;
    description: string;
}

// Lo que devuelve una tool al cliente MCP.
// `content` es el texto que lee el LLM; `isError` le avisa que la operación
// falló y que no debe interpretar el resultado como un éxito.
export type ToolResponse = CallToolResult;

export interface ToolContext {
    github: GitHubOperations;
    requestId?: string;
}

export interface McpTool {
    definition: McpToolDefinition;
    schema: ZodType;
    handler(input: unknown, context: ToolContext): Promise<ToolResponse>;
}