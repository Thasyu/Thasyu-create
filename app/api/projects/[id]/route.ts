import {
  consumeIpRateLimit,
  getClientIpKey,
  githubPagesUnavailableResponse,
  isGitHubPagesBuild,
  jsonWithSecurityHeaders,
  noContentWithSecurityHeaders,
  parsePositiveIntegerId,
} from "@/lib/apiRouteUtils";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const MAX_PROJECT_TITLE_LENGTH = 120;
const MAX_PROJECT_CONTENT_LENGTH = 1_000_000;
const PROJECT_ITEM_READ_WINDOW_MS = 60_000;
const PROJECT_ITEM_READ_MAX_REQUESTS = 180;
const PROJECT_ITEM_WRITE_WINDOW_MS = 60_000;
const PROJECT_ITEM_WRITE_MAX_REQUESTS = 60;

const parseContentBody = (body: unknown) => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const title = (body as { title?: unknown }).title;
  const content = (body as { content?: unknown }).content;

  if (typeof content !== "string") {
    return null;
  }

  if (title !== undefined && typeof title !== "string") {
    return null;
  }

  const payload: { content: string; title?: string } = { content };

  if (typeof title === "string") {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return null;
    }

    if (normalizedTitle.length > MAX_PROJECT_TITLE_LENGTH) {
      return null;
    }
    payload.title = normalizedTitle;
  }

  if (content.length > MAX_PROJECT_CONTENT_LENGTH) {
    return null;
  }

  return payload;
};

export async function GET(request: Request, { params }: RouteParams) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const rateLimitResult = consumeIpRateLimit(
    "projects:item:read",
    getClientIpKey(request),
    PROJECT_ITEM_READ_WINDOW_MS,
    PROJECT_ITEM_READ_MAX_REQUESTS
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

  const { id } = await params;
  const projectId = parsePositiveIntegerId(id);

  if (!projectId) {
    return jsonWithSecurityHeaders({ error: "Invalid project id." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return jsonWithSecurityHeaders({ error: "Project not found." }, { status: 404 });
  }

  return jsonWithSecurityHeaders(project, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const rateLimitResult = consumeIpRateLimit(
    "projects:item:write",
    getClientIpKey(request),
    PROJECT_ITEM_WRITE_WINDOW_MS,
    PROJECT_ITEM_WRITE_MAX_REQUESTS
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

  const { id } = await params;
  const projectId = parsePositiveIntegerId(id);

  if (!projectId) {
    return jsonWithSecurityHeaders({ error: "Invalid project id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const payload = parseContentBody(body);

  if (!payload) {
    return jsonWithSecurityHeaders(
      { error: "Invalid request body. content(string) is required." },
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: payload,
    });

    return jsonWithSecurityHeaders(project, { status: 200 });
  } catch {
    return jsonWithSecurityHeaders({ error: "Project not found." }, { status: 404 });
  }
}

export async function PUT(request: Request, context: RouteParams) {
  return PATCH(request, context);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const rateLimitResult = consumeIpRateLimit(
    "projects:item:write",
    getClientIpKey(request),
    PROJECT_ITEM_WRITE_WINDOW_MS,
    PROJECT_ITEM_WRITE_MAX_REQUESTS
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

  const { id } = await params;
  const projectId = parsePositiveIntegerId(id);

  if (!projectId) {
    return jsonWithSecurityHeaders({ error: "Invalid project id." }, { status: 400 });
  }

  try {
    await prisma.project.delete({
      where: { id: projectId },
    });

    return noContentWithSecurityHeaders({ status: 204 });
  } catch {
    return jsonWithSecurityHeaders({ error: "Project not found." }, { status: 404 });
  }
}
