import { Suspense } from "react";

import ClipSettingsClient from "./[clipId]/ClipSettingsClient";

export default function ClipSettingsIndexPage() {
	return (
		<Suspense fallback={null}>
			<ClipSettingsClient />
		</Suspense>
	);
}
