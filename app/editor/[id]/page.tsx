import { redirect } from "next/navigation";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ id: "sample" }];
}

type EditorProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditorProjectPage({ params }: EditorProjectPageProps) {
  const { id } = await params;
  redirect(`/editor?projectId=${encodeURIComponent(id)}`);
}
