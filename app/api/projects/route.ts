import { NextResponse } from "next/server";

import { githubPagesUnavailableResponse, isGitHubPagesBuild } from "@/lib/apiRouteUtils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CreateProjectBody = {
  title: string;
  content: string;
};

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

  return {
    title: normalizedTitle,
    content,
  };
};

export async function GET() {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const projects = await prisma.project.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json(projects, { status: 200 });
}

export async function POST(request: Request) {
  if (isGitHubPagesBuild) {
    return githubPagesUnavailableResponse();
  }

  const payload = parseCreateProjectBody(await request.json());

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid request body. title(string), content(string) are required." },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: payload,
  });

  return NextResponse.json(project, { status: 201 });
}
