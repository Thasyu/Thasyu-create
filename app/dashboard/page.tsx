"use client";

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
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">プロジェクト管理</h1>
        <button
          onClick={handleCreate}
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80"
        >
          新規作成
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-black/10">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-black/5">
            <tr>
              <th className="px-4 py-3 font-semibold">タイトル</th>
              <th className="px-4 py-3 font-semibold">最終更新</th>
              <th className="px-4 py-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center">読み込み中...</td></tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-white">
                  プロジェクトはありません。
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id} className="border-t border-black/10 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium">{project.title}</td>
                  <td className="px-4 py-3 text-black/60">
                    {dateFormatter.format(new Date(project.updatedAt))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(project.id)}
                      className="rounded-md border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}