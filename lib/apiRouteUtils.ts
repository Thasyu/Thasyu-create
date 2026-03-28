import { NextResponse } from "next/server";

const GITHUB_PAGES_UNAVAILABLE_ERROR = "Not available on GitHub Pages.";

type RateLimitState = {
	count: number;
	resetAt: number;
};

const securityHeaders = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "strict-origin-when-cross-origin",
};

const globalForApiRouteUtils = globalThis as unknown as {
	apiRateLimitStore?: Map<string, RateLimitState>;
};

const apiRateLimitStore = globalForApiRouteUtils.apiRateLimitStore ?? new Map<string, RateLimitState>();
globalForApiRouteUtils.apiRateLimitStore = apiRateLimitStore;

export const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

export const githubPagesUnavailableResponse = () =>
	NextResponse.json(
		{ error: GITHUB_PAGES_UNAVAILABLE_ERROR },
		{ status: 501, headers: securityHeaders }
	);

export const jsonWithSecurityHeaders = <T>(body: T, init?: ResponseInit): NextResponse<T> => {
	const headers = new Headers(init?.headers);
	for (const [name, value] of Object.entries(securityHeaders)) {
		headers.set(name, value);
	}

	return NextResponse.json(body, {
		...init,
		headers,
	});
};

export const noContentWithSecurityHeaders = (init?: ResponseInit): NextResponse => {
	const headers = new Headers(init?.headers);
	for (const [name, value] of Object.entries(securityHeaders)) {
		headers.set(name, value);
	}

	return new NextResponse(null, {
		...init,
		headers,
		status: init?.status ?? 204,
	});
};

export const getClientIpKey = (request: Request): string => {
	const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
	const firstIp = forwardedFor
		.split(",")
		.map((part) => part.trim())
		.find((part) => part.length > 0);
	const realIp = request.headers.get("x-real-ip")?.trim();

	return firstIp ?? realIp ?? "unknown";
};

export const consumeIpRateLimit = (
	bucket: string,
	clientKey: string,
	windowMs: number,
	maxRequests: number
): { allowed: true } | { allowed: false; retryAfterSeconds: number } => {
	const now = Date.now();
	const mapKey = `${bucket}:${clientKey}`;
	const state = apiRateLimitStore.get(mapKey);

	for (const [key, value] of apiRateLimitStore) {
		if (value.resetAt <= now) {
			apiRateLimitStore.delete(key);
		}
	}

	if (!state || state.resetAt <= now) {
		apiRateLimitStore.set(mapKey, {
			count: 1,
			resetAt: now + windowMs,
		});
		return { allowed: true };
	}

	if (state.count >= maxRequests) {
		return {
			allowed: false,
			retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
		};
	}

	state.count += 1;
	apiRateLimitStore.set(mapKey, state);
	return { allowed: true };
};

export const parsePositiveIntegerId = (value: string): number | null => {
	const id = Number(value);

	if (!Number.isInteger(id) || id <= 0) {
		return null;
	}

	return id;
};