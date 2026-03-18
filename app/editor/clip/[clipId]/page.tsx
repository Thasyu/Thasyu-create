import { redirect } from "next/navigation";

type ClipSettingsLegacyPageProps = {
	params: Promise<{ clipId: string }>;
	searchParams?: Promise<{ projectId?: string | string[] }>;
};

export default async function ClipSettingsLegacyPage({
	params,
	searchParams,
}: ClipSettingsLegacyPageProps) {
	const { clipId } = await params;
	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const projectIdRaw = resolvedSearchParams?.projectId;
	const projectId = Array.isArray(projectIdRaw) ? projectIdRaw[0] : projectIdRaw;
	const query = new URLSearchParams({ clipId });
	if (projectId) {
		query.set("projectId", projectId);
	}
	redirect(`/editor/clip?${query.toString()}`);
}
