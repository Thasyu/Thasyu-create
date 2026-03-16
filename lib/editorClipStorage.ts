export const EDITOR_CLIPS_STORAGE_KEY = "editor:clips";
export const EDITOR_SELECTED_CLIP_KEY = "editor:selectedClipId";

const isBrowser = (): boolean => typeof window !== "undefined";

export const readEditorClips = <T>(fallback: T[]): T[] => {
	if (!isBrowser()) {
		return fallback;
	}

	const savedClipsRaw = window.localStorage.getItem(EDITOR_CLIPS_STORAGE_KEY);
	if (!savedClipsRaw) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(savedClipsRaw) as T[];
		if (Array.isArray(parsed)) {
			return parsed;
		}
	} catch {
		window.localStorage.removeItem(EDITOR_CLIPS_STORAGE_KEY);
	}

	return fallback;
};

export const writeEditorClips = <T>(clips: T[]): void => {
	if (!isBrowser()) {
		return;
	}
	window.localStorage.setItem(EDITOR_CLIPS_STORAGE_KEY, JSON.stringify(clips));
};

export const readEditorSelectedClipId = (): string => {
	if (!isBrowser()) {
		return "";
	}
	return window.localStorage.getItem(EDITOR_SELECTED_CLIP_KEY) ?? "";
};

export const writeEditorSelectedClipId = (clipId: string): void => {
	if (!isBrowser()) {
		return;
	}

	if (clipId) {
		window.localStorage.setItem(EDITOR_SELECTED_CLIP_KEY, clipId);
		return;
	}

	window.localStorage.removeItem(EDITOR_SELECTED_CLIP_KEY);
};