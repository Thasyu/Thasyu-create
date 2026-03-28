import {
  consumeIpRateLimit,
  getClientIpKey,
  githubPagesUnavailableResponse,
  isGitHubPagesBuild,
  jsonWithSecurityHeaders,
} from "@/lib/apiRouteUtils";
import { prisma } from "@/lib/prisma";

type CreateProjectBody = {
  title: string;
  content: string;
};

const MAX_PROJECT_TITLE_LENGTH = 120;
const MAX_PROJECT_CONTENT_LENGTH = 1_000_000;
const PROJECTS_READ_WINDOW_MS = 60_000;
const PROJECTS_READ_MAX_REQUESTS = 120;
const PROJECTS_WRITE_WINDOW_MS = 60_000;
const PROJECTS_WRITE_MAX_REQUESTS = 40;

const parseCreateProjectBody = (body: unknown): CreateProjectBody | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const title = (body as { title?: unknown }).title;
  const content = (body as { content?: unknown }).content;

  if (typeof title !== "string" || typeof content !== "string") {
    return null;
  }

  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return null;
  }

  if (normalizedTitle.length > MAX_PROJECT_TITLE_LENGTH) {
    return null;
  }

  if (content.length > MAX_PROJECT_CONTENT_LENGTH) {
    return null;
  }

  return {
    title: normalizedTitle,
    content,
  };
};

export async function GET(request: Request) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const rateLimitResult = consumeIpRateLimit(
    "projects:collection:read",
    getClientIpKey(request),
    PROJECTS_READ_WINDOW_MS,
    PROJECTS_READ_MAX_REQUESTS
  );

  if (!rateLimitResult.allowed) {
    return jsonWithSecurityHeaders(
      { error: "Too many requests. Please retry later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      }
    );
  }

  const projects = await prisma.project.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });

  return jsonWithSecurityHeaders(projects, { status: 200 });
}

export async function POST(request: Request) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const rateLimitResult = consumeIpRateLimit(
    "projects:collection:write",
    getClientIpKey(request),
    PROJECTS_WRITE_WINDOW_MS,
    PROJECTS_WRITE_MAX_REQUESTS
  );

  if (!rateLimitResult.allowed) {
    return jsonWithSecurityHeaders(
      { error: "Too many requests. Please retry later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const payload = parseCreateProjectBody(body);

  if (!payload) {
    return jsonWithSecurityHeaders(
      { error: "Invalid request body. title(string), content(string) are required." },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: payload,
  });

  return jsonWithSecurityHeaders(project, { status: 201 });
}
