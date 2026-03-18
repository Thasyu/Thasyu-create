import { NextResponse } from "next/server";

import {
  githubPagesUnavailableResponse,
  isGitHubPagesBuild,
  parsePositiveIntegerId,
} from "@/lib/apiRouteUtils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

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
    payload.title = normalizedTitle;
  }

  return payload;
};

export async function GET(_: Request, { params }: RouteParams) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const { id } = await params;
  const projectId = parsePositiveIntegerId(id);

  if (!projectId) {
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json(project, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const { id } = await params;
  const projectId = parsePositiveIntegerId(id);

  if (!projectId) {
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  const payload = parseContentBody(await request.json());

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid request body. content(string) is required." },
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: payload,
    });

    return NextResponse.json(project, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
}

export async function PUT(request: Request, context: RouteParams) {
  return PATCH(request, context);
}

export async function DELETE(_: Request, { params }: RouteParams) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const { id } = await params;
  const projectId = parsePositiveIntegerId(id);

  if (!projectId) {
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  try {
    await prisma.project.delete({
      where: { id: projectId },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
}
