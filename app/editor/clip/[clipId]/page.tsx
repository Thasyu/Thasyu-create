import ClipSettingsClient from "./ClipSettingsClient";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
	return [{ clipId: "sample" }];
}

export default function ClipSettingsPage() {
	return <ClipSettingsClient />;
}
