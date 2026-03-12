import EditorProjectClient from "./EditorProjectClient";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ id: "sample" }];
}

export default function EditorProjectPage() {
  return <EditorProjectClient />;
}
