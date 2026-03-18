"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Project = {
  id: number;
  title: string;
  content: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renamingProjectId, setRenamingProjectId] = useState<number | null>(null);
  const skipBlurSaveRef = useRef(false);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("プロジェクト一覧の取得に失敗しました。");
      }

      const data = (await response.json()) as Project[];
      setProjects(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "読み込みに失敗しました。");
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "無題のプロジェクト",
          content: JSON.stringify({ clips: [], selectedClipId: "" }),
        }),
      });

      if (!response.ok) {
        throw new Error("新規作成に失敗しました。");
      }

      const created = (await response.json()) as Project;
      router.push(`/editor?projectId=${created.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "新規作成に失敗しました。");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 404) {
        throw new Error("削除に失敗しました。");
      }

      setProjects((prev) => prev.filter((project) => project.id !== projectId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "削除に失敗しました。");
    }
  };

  const startRename = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingTitle(project.title);
    setError(null);
  };

  const cancelRename = () => {
    setEditingProjectId(null);
    setEditingTitle("");
  };

  const handleRename = async (project: Project) => {
    if (renamingProjectId !== null) {
      return;
    }

    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle || trimmedTitle === project.title) {
      cancelRename();
      return;
    }

    setRenamingProjectId(project.id);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          content: project.content,
        }),
      });

      if (!response.ok) {
        throw new Error("名前変更に失敗しました。");
      }

      const updated = (await response.json()) as Project;
      setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      cancelRename();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "名前変更に失敗しました。");
    } finally {
      setRenamingProjectId(null);
    }
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
            <Link
              href="/"
              className="rounded-xl border border-zinc-500/70 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700/30"
            >
              ホームへ
            </Link>
            <button
              onClick={handleCreate}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              disabled={isCreating}
            >
              {isCreating ? "作成中..." : "新規作成"}
            </button>
          </div>
        </header>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

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
                      {editingProjectId === project.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                              return;
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              skipBlurSaveRef.current = true;
                              cancelRename();
                            }
                          }}
                          onBlur={() => {
                            if (skipBlurSaveRef.current) {
                              skipBlurSaveRef.current = false;
                              return;
                            }
                            void handleRename(project);
                          }}
                          className="w-full rounded-md border border-zinc-500/70 bg-zinc-900 px-2 py-1 text-sm font-semibold text-zinc-100 outline-none ring-blue-500/70 focus:ring"
                          placeholder="プロジェクト名"
                        />
                      ) : (
                        <p className="truncate font-semibold text-zinc-100">{project.title}</p>
                      )}
                      <p className="mt-1 text-xs text-zinc-400 sm:hidden">
                        {dateFormatter.format(new Date(project.updatedAt))}
                      </p>
                    </div>

                    <p className="hidden text-sm text-zinc-300 sm:block">
                      {dateFormatter.format(new Date(project.updatedAt))}
                    </p>

                    <div className="flex items-center justify-end gap-2">
                      {editingProjectId === project.id ? (
                        <>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              void handleRename(project);
                            }}
                            className="rounded-md border border-emerald-500/80 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:opacity-60"
                            disabled={renamingProjectId === project.id}
                          >
                            {renamingProjectId === project.id ? "保存中..." : "保存"}
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              skipBlurSaveRef.current = true;
                              cancelRename();
                            }}
                            className="rounded-md border border-zinc-500/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700/30"
                            disabled={renamingProjectId === project.id}
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startRename(project)}
                          className="rounded-md border border-zinc-500/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700/30"
                        >
                          名前変更
                        </button>
                      )}
                      <Link
                        href={`/editor?projectId=${project.id}`}
                        className="rounded-md border border-blue-500/60 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/10"
                      >
                        再開
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