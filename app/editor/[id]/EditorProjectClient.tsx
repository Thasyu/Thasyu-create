"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ProjectResponse = {
  id: number;
  title: string;
  content: string;
  updatedAt: string;
};

const parseJsonContent = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export default function EditorProjectClient() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [content, setContent] = useState<unknown>(null);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const loadProject = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("プロジェクトの取得に失敗しました。");
        }

        const data = (await response.json()) as ProjectResponse;
        setTitle(data.title);
        setContent(parseJsonContent(data.content));
      } catch {
        setError("プロジェクトを読み込めませんでした。");
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">エディター</h1>
      <p className="mt-2 text-sm text-black/70">ID: {projectId}</p>

      {isLoading ? (
        <p className="mt-6">読み込み中...</p>
      ) : error ? (
        <p className="mt-6 text-red-600">{error}</p>
      ) : (
        <section className="mt-6 space-y-4">
          <p className="text-lg font-semibold">{title}</p>
          <pre className="overflow-auto rounded-lg border border-black/10 bg-black/5 p-4 text-sm">
            {JSON.stringify(content, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}