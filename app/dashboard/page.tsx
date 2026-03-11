"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Project = {
  id: number;
  title: string;
  updatedAt: string;
};

const STORAGE_KEY = "projects";

const readProjects = (): Project[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is Project =>
        typeof item?.id === "number" &&
        typeof item?.title === "string" &&
        typeof item?.updatedAt === "string"
    );
  } catch {
    return [];
  }
};

const writeProjects = (projects: Project[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = () => {
    setIsLoading(true);
    const data = readProjects();
    setProjects(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = () => {
    const current = readProjects();
    const maxId = current.reduce((max, project) => Math.max(max, project.id), 0);
    const newProject: Project = {
      id: maxId + 1,
      title: "無題のプロジェクト",
      updatedAt: new Date().toISOString(),
    };
    const nextProjects = [newProject, ...current];
    writeProjects(nextProjects);
    setProjects(nextProjects);
  };

  const handleDelete = (projectId: number) => {
    const current = readProjects();
    const nextProjects = current.filter((project) => project.id !== projectId);
    writeProjects(nextProjects);
    setProjects(nextProjects);
  };

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-zinc-100">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="animated-bg-wave absolute inset-[-35%] opacity-90" />
        <div className="animated-orb orb-one absolute -left-40 top-[-14%] h-[42rem] w-[42rem] rounded-full bg-blue-500/35 blur-[130px]" />
        <div className="animated-orb-reverse orb-two absolute -right-36 top-[10%] h-[36rem] w-[36rem] rounded-full bg-cyan-400/25 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10 md:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-blue-300/80">PROJECTS</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">プロジェクト管理</h1>
            <p className="mt-2 text-sm text-zinc-300">作成済みプロジェクトを一覧で管理できます。</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
              合計 {projects.length} 件
            </span>
            <button
              onClick={handleCreate}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              新規作成
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-blue-500/20 bg-zinc-900/75 p-3 backdrop-blur">
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/70">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-zinc-700/60 px-4 py-3 text-xs font-semibold tracking-wide text-zinc-400">
              <p>タイトル</p>
              <p className="hidden sm:block">最終更新</p>
              <p className="text-right">操作</p>
            </div>

            {isLoading ? (
              <p className="px-4 py-12 text-center text-zinc-300">読み込み中...</p>
            ) : projects.length === 0 ? (
              <p className="px-4 py-12 text-center text-white">プロジェクトはありません。</p>
            ) : (
              <ul className="divide-y divide-zinc-700/60">
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-4 transition hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-100">{project.title}</p>
                      <p className="mt-1 text-xs text-zinc-400 sm:hidden">
                        {dateFormatter.format(new Date(project.updatedAt))}
                      </p>
                    </div>

                    <p className="hidden text-sm text-zinc-300 sm:block">
                      {dateFormatter.format(new Date(project.updatedAt))}
                    </p>

                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/editor/${project.id}`}
                        className="rounded-md border border-blue-500/60 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/10"
                      >
                        開く
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(project.id)}
                        className="rounded-md border border-red-500/70 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}