import { redirect } from "next/navigation";

type EditorProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditorProjectPage({ params }: EditorProjectPageProps) {
  const { id } = await params;
  redirect(`/editor?projectId=${encodeURIComponent(id)}`);
}
