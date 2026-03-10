// app/api/projects/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export const runtime = "nodejs";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

// GET: DBから全プロジェクトを取得
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST: 新しいプロジェクトをDBに作成
export async function POST() {
  try {
    const newProject = await prisma.project.create({
      data: {
        title: "無題のプロジェクト",
        content: "{}", // 初期データ
      },
    });
    return NextResponse.json(newProject);
  } catch (error) {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}

// DELETE: 指定idのプロジェクトをDBから削除
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const projectId = Number(body?.id);

    if (!Number.isInteger(projectId)) {
      return NextResponse.json({ error: "不正なIDです" }, { status: 400 });
    }

    const result = await prisma.project.deleteMany({
      where: { id: projectId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}