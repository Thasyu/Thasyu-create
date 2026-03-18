import { NextResponse } from "next/server";

const GITHUB_PAGES_UNAVAILABLE_ERROR = "Not available on GitHub Pages.";

export const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

export const githubPagesUnavailableResponse = () =>
	NextResponse.json({ error: GITHUB_PAGES_UNAVAILABLE_ERROR }, { status: 501 });

export const parsePositiveIntegerId = (value: string): number | null => {
	const id = Number(value);

	if (!Number.isInteger(id) || id <= 0) {
		return null;
	}

	return id;
};