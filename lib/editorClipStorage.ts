export const EDITOR_CLIPS_STORAGE_KEY = "editor:clips";
export const EDITOR_SELECTED_CLIP_KEY = "editor:selectedClipId";
export const EDITOR_PROJECT_ID_KEY = "editor:projectId";

const isBrowser = (): boolean => typeof window !== "undefined";

const normalizeProjectIdValue = (value: string): string => {
	const normalized = value.trim().replace(/\/+$/, "");
	if (!normalized) {
		return "";
	}

	const numeric = Number(normalized);
	if (!Number.isInteger(numeric) || numeric <= 0) {
		return "";
	}

	return String(numeric);
};

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

export const hasEditorClipsSnapshot = (): boolean => {
	if (!isBrowser()) {
		return false;
	}
	return window.localStorage.getItem(EDITOR_CLIPS_STORAGE_KEY) !== null;
};

export const readEditorProjectId = (): string => {
	if (!isBrowser()) {
		return "";
	}
	const storedValue = window.localStorage.getItem(EDITOR_PROJECT_ID_KEY);
	if (!storedValue) {
		return "";
	}

	const normalized = normalizeProjectIdValue(storedValue);
	if (normalized !== storedValue) {
		if (normalized) {
			window.localStorage.setItem(EDITOR_PROJECT_ID_KEY, normalized);
		} else {
			window.localStorage.removeItem(EDITOR_PROJECT_ID_KEY);
		}
	}

	return normalized;
};

export const writeEditorProjectId = (projectId: string): void => {
	if (!isBrowser()) {
		return;
	}
	const normalized = normalizeProjectIdValue(projectId);

	if (normalized) {
		window.localStorage.setItem(EDITOR_PROJECT_ID_KEY, normalized);
		return;
	}

	window.localStorage.removeItem(EDITOR_PROJECT_ID_KEY);
};