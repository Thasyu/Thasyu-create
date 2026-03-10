"use client";

import { useEffect, useMemo, useState } from "react";

type Project = {
  id: number;
  title: string;
  updatedAt: string;
};

export default function DashboardPage() {
  // 初期データ(initialProjects)を消し、空の配列から開始します
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- データのやり取り (API連携) ---

  // 1. 一覧取得
  const fetchProjects = async () => {
    setIsLoading(true);
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (Array.isArray(data)) {
      setProjects(data);
    }
    setIsLoading(false);
  };

  // 画面が開いた時に一度だけ実行
  useEffect(() => {
    fetchProjects();
  }, []);

  // 2. 新規作成
  const handleCreate = async () => {
    const res = await fetch("/api/projects", { method: "POST" });
    if (res.ok) {
      // 作成に成功したら一覧を再取得
      fetchProjects();
    }
  };

  // 3. 削除
  const handleDelete = async (projectId: number) => {
    const res = await fetch("/api/projects", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: projectId }),
    });

    if (res.ok) {
      fetchProjects();
    }
  };

  // --- 見た目の処理 ---

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
                <td colSpan={3} className="px-4 py-6 text-center text-black/60">
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