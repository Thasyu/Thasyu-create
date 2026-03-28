import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { githubPagesUnavailableResponse, isGitHubPagesBuild } from "@/lib/apiRouteUtils";

export const runtime = "nodejs";
export const dynamic = "force-static";

type TransitionType = "none" | "fade" | "slide" | "glitch" | "pixelate" | "rgbShift";
type TransitionEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";
type FontWeightValue = 300 | 400 | 500 | 700 | 900;
type LetterSpacingUnit = "px" | "em";
type TextAlignMode = "left" | "center" | "right";
type TextTransformMode = "none" | "uppercase" | "lowercase";
type AnchorXMode = "left" | "center" | "right";
type AnchorYMode = "top" | "middle" | "bottom";

const availableFonts = [
	"Inter",
	"Roboto",
	"Poppins",
	"Montserrat",
	"Bebas Neue",
	"Anton",
	"Oswald",
	"Noto Sans JP",
	"M PLUS 1p",
	"Zen Maru Gothic",
	"Kosugi",
	"Noto Serif JP",
	"Playfair Display",
	"Pacifico",
	"Dancing Script",
] as const;
const availableFontSet = new Set<string>(availableFonts);
const defaultFontFamily = "Inter";
const defaultFontWeight: FontWeightValue = 700;
const fontWeightsByFamily: Record<string, readonly FontWeightValue[]> = {
	Inter: [300, 400, 500, 700, 900],
	Roboto: [300, 400, 500, 700, 900],
	Poppins: [300, 400, 500, 700, 900],
	Montserrat: [300, 400, 500, 700, 900],
	"Bebas Neue": [400],
	Anton: [400],
	Oswald: [300, 400, 500, 700],
	"Noto Sans JP": [300, 400, 500, 700, 900],
	"M PLUS 1p": [300, 400, 500, 700, 900],
	"Zen Maru Gothic": [300, 400, 500, 700, 900],
	Kosugi: [400],
	"Noto Serif JP": [300, 400, 500, 700, 900],
	"Playfair Display": [400, 500, 700, 900],
	Pacifico: [400],
	"Dancing Script": [400, 500, 700],
};

const transitionEasingTypes: TransitionEasing[] = ["linear", "easeIn", "easeOut", "easeInOut"];

const isTransitionEasing = (value: unknown): value is TransitionEasing => {
	return transitionEasingTypes.includes(value as TransitionEasing);
};

const getEnvInt = (name: string, fallback: number, min: number, max: number): number => {
	const raw = process.env[name];
	if (!raw) {
		return fallback;
	}

	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, parsed));
};

type RenderTextClipInput = {
	id: string;
	text: string;
	start: number;
	length: number;
	zIndex?: number;
	track?: number;
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: number;
	textTransform?: TextTransformMode;
	textAlign?: TextAlignMode;
	strokeColor?: string;
	strokeWidth?: number;
	letterSpacing?: number;
	letterSpacingUnit?: LetterSpacingUnit;
	lineHeight?: number;
	opacity?: number;
	shadowColor?: string;
	shadowBlur?: number;
	shadowOffsetX?: number;
	shadowOffsetY?: number;
	shadowOpacity?: number;
	shadowEnabled?: boolean;
	glowColor?: string;
	glowStrength?: number;
	glowEnabled?: boolean;
	glowBlur?: number;
	glowOpacity?: number;
	backgroundColor?: string;
	backgroundPaddingX?: number;
	backgroundPaddingY?: number;
	backgroundRadius?: number;
	backgroundEnabled?: boolean;
	backgroundOpacity?: number;
	backgroundBorderColor?: string;
	backgroundBorderWidth?: number;
	color?: string;
	positionX?: number;
	positionY?: number;
	anchorX?: AnchorXMode;
	anchorY?: AnchorYMode;
	transitions?: {
		inPoint?: { duration?: number; effect?: TransitionType; easing?: TransitionEasing };
		outPoint?: { duration?: number; effect?: TransitionType; easing?: TransitionEasing };
	};
};

type RenderRequestBody = {
	clips: RenderTextClipInput[];
	fps?: number;
	width?: number;
	height?: number;
	projectName?: string;
	backgroundColor?: string;
};

type NormalizedClip = {
	id: string;
	text: string;
	start: number;
	end: number;
	length: number;
	zIndex: number;
	fontSize: number;
	fontFamily: string;
	fontWeight: FontWeightValue;
	textTransform: TextTransformMode;
	textAlign: TextAlignMode;
	strokeColor: string;
	strokeWidth: number;
	letterSpacing: number;
	letterSpacingUnit: LetterSpacingUnit;
	letterSpacingPx: number;
	lineHeight: number;
	opacity: number;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	shadowOpacity: number;
	shadowEnabled: boolean;
	glowColor: string;
	glowStrength: number;
	glowEnabled: boolean;
	glowBlur: number;
	glowOpacity: number;
	backgroundColor: string;
	backgroundPaddingX: number;
	backgroundPaddingY: number;
	backgroundRadius: number;
	backgroundEnabled: boolean;
	backgroundOpacity: number;
	backgroundBorderColor: string;
	backgroundBorderWidth: number;
	color: string;
	x: number;
	y: number;
	anchorX: AnchorXMode;
	anchorY: AnchorYMode;
	inDuration: number;
	outDuration: number;
	inEasing: TransitionEasing;
	outEasing: TransitionEasing;
};

const MAX_CLIPS = getEnvInt("RENDER_MAX_CLIPS", 120, 1, 2_000);
const MAX_WIDTH = getEnvInt("RENDER_MAX_WIDTH", 1920, 320, 7680);
const MAX_HEIGHT = getEnvInt("RENDER_MAX_HEIGHT", 1080, 180, 4320);
const MAX_FPS = getEnvInt("RENDER_MAX_FPS", 60, 12, 240);
const MAX_DURATION_SECONDS = getEnvInt("RENDER_MAX_DURATION_SECONDS", 180, 1, 3_600);
const MAX_TOTAL_TEXT_LENGTH = getEnvInt("RENDER_MAX_TOTAL_TEXT_LENGTH", 20_000, 100, 2_000_000);
const MAX_RENDER_CONCURRENCY = getEnvInt("RENDER_MAX_CONCURRENCY", 2, 1, 16);
const RENDER_RATE_LIMIT_WINDOW_MS = getEnvInt("RENDER_RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000);
const RENDER_RATE_LIMIT_MAX_REQUESTS = getEnvInt("RENDER_RATE_LIMIT_MAX_REQUESTS", 20, 1, 10_000);

type RateLimitState = {
	count: number;
	resetAt: number;
};

const globalForRenderGuards = globalThis as unknown as {
	renderRateLimitStore?: Map<string, RateLimitState>;
	renderInFlightCount?: number;
};

const renderRateLimitStore = globalForRenderGuards.renderRateLimitStore ?? new Map<string, RateLimitState>();
globalForRenderGuards.renderRateLimitStore = renderRateLimitStore;

if (typeof globalForRenderGuards.renderInFlightCount !== "number") {
	globalForRenderGuards.renderInFlightCount = 0;
}

const getClientKey = (request: Request): string => {
	const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
	const firstIp = forwardedFor
		.split(",")
		.map((item) => item.trim())
		.find((item) => item.length > 0);
	const realIp = request.headers.get("x-real-ip")?.trim();

	return firstIp ?? realIp ?? "unknown";
};

const consumeRateLimit = (key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } => {
	const now = Date.now();
	const existing = renderRateLimitStore.get(key);

	if (!existing || existing.resetAt <= now) {
		renderRateLimitStore.set(key, {
			count: 1,
			resetAt: now + RENDER_RATE_LIMIT_WINDOW_MS,
		});
		return { allowed: true };
	}

	if (existing.count >= RENDER_RATE_LIMIT_MAX_REQUESTS) {
		const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
		return { allowed: false, retryAfterSeconds };
	}

	existing.count += 1;
	renderRateLimitStore.set(key, existing);
	return { allowed: true };
};

const toNumber = (value: unknown, fallback: number): number => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : fallback;
};

const escapeDrawText = (value: string): string => {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/:/g, "\\:")
		.replace(/'/g, "\\'")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;")
		.replace(/\n/g, "\\n");
};

const toFontFamily = (value: unknown): string => {
	if (typeof value !== "string") {
		return defaultFontFamily;
	}
	return availableFontSet.has(value) ? value : defaultFontFamily;
};

const isHexColor = (value: unknown): value is string => {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
};

const isTextAlignMode = (value: unknown): value is TextAlignMode => {
	return value === "left" || value === "center" || value === "right";
};

const isTextTransformMode = (value: unknown): value is TextTransformMode => {
	return value === "none" || value === "uppercase" || value === "lowercase";
};

const isAnchorXMode = (value: unknown): value is AnchorXMode => {
	return value === "left" || value === "center" || value === "right";
};

const isAnchorYMode = (value: unknown): value is AnchorYMode => {
	return value === "top" || value === "middle" || value === "bottom";
};

const getSupportedFontWeights = (fontFamily: string): readonly FontWeightValue[] => {
	return fontWeightsByFamily[fontFamily] ?? [300, 400, 500, 700, 900];
};

const toFontWeight = (value: unknown, fontFamily: string): FontWeightValue => {
	const supportedWeights = getSupportedFontWeights(fontFamily);
	const numeric = Number(value);
	if (supportedWeights.includes(numeric as FontWeightValue)) {
		return numeric as FontWeightValue;
	}
	if (supportedWeights.includes(defaultFontWeight)) {
		return defaultFontWeight;
	}
	return supportedWeights[0] ?? 400;
};

const toTextAlignMode = (value: unknown): TextAlignMode => {
	return isTextAlignMode(value) ? value : "center";
};

const toTextTransformMode = (value: unknown): TextTransformMode => {
	return isTextTransformMode(value) ? value : "none";
};

const toAnchorXMode = (value: unknown): AnchorXMode => {
	return isAnchorXMode(value) ? value : "center";
};

const toAnchorYMode = (value: unknown): AnchorYMode => {
	return isAnchorYMode(value) ? value : "middle";
};

const applyTextTransform = (text: string, mode: TextTransformMode): string => {
	switch (mode) {
		case "uppercase":
			return text.toUpperCase();
		case "lowercase":
			return text.toLowerCase();
		case "none":
		default:
			return text;
	}
};

const toFontStyleName = (weight: FontWeightValue): "Light" | "Regular" | "Medium" | "Bold" | "Black" => {
	switch (weight) {
		case 300:
			return "Light";
		case 400:
			return "Regular";
		case 500:
			return "Medium";
		case 900:
			return "Black";
		case 700:
		default:
			return "Bold";
	}
};

const isLetterSpacingUnit = (value: unknown): value is LetterSpacingUnit => {
	return value === "px" || value === "em";
};

const toLetterSpacingUnit = (value: unknown): LetterSpacingUnit => {
	return isLetterSpacingUnit(value) ? value : "em";
};

const toLetterSpacing = (value: unknown, unit: LetterSpacingUnit): number => {
	const numeric = toNumber(value, 0);
	if (unit === "em") {
		return Math.min(Math.max(numeric, -0.1), 1);
	}
	return Math.min(Math.max(numeric, -10), 160);
};

const toLetterSpacingPx = (value: number, unit: LetterSpacingUnit, fontSize: number): number => {
	return unit === "em" ? value * fontSize : value;
};

const toLineHeight = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 1.2), 0), 2);
};

const toStrokeWidth = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 0), 0), 5);
};

const toOpacity = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 1), 0), 1);
};

const toShadowBlur = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 14), 0), 100);
};

const toShadowOffset = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 0), -200), 200);
};

const toShadowOpacity = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 0.45), 0), 1);
};

const toShadowEnabled = (value: unknown): boolean => {
	if (typeof value === "boolean") {
		return value;
	}
	return true;
};

const toGlowStrength = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 1), 0), 5);
};

const toGlowBlur = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 24), 0), 120);
};

const toGlowOpacity = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 0.7), 0), 1);
};

const toGlowEnabled = (value: unknown): boolean => {
	if (typeof value === "boolean") {
		return value;
	}
	return false;
};

const toBackgroundPaddingX = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 16), 0), 200);
};

const toBackgroundPaddingY = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 8), 0), 200);
};

const toBackgroundRadius = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 12), 0), 200);
};

const toBackgroundEnabled = (value: unknown): boolean => {
	if (typeof value === "boolean") {
		return value;
	}
	return false;
};

const toBackgroundOpacity = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 0.55), 0), 1);
};

const toBackgroundBorderWidth = (value: unknown): number => {
	return Math.min(Math.max(toNumber(value, 0), 0), 20);
};

const applyLetterSpacingApproximation = (text: string, letterSpacingPx: number): string => {
	if (letterSpacingPx <= 0.2) {
		return text;
	}

	const spacer = letterSpacingPx <= 1.5 ? "\u200A" : letterSpacingPx <= 3 ? "\u2009" : "\u2005";
	const spacerRepeat = Math.max(1, Math.round(letterSpacingPx / 2));
	const spacerToken = spacer.repeat(spacerRepeat);

	return text
		.split(/\r?\n/)
		.map((line) => {
			const chars = Array.from(line);
			if (chars.length <= 1) {
				return line;
			}
			return chars.join(spacerToken);
		})
		.join("\n");
};

const applyTextAlignApproximation = (text: string, textAlign: TextAlignMode): string => {
	if (textAlign === "left") {
		return text;
	}

	const lines = text.split(/\r?\n/);
	const maxLength = lines.reduce((max, line) => Math.max(max, Array.from(line).length), 0);

	return lines
		.map((line) => {
			const length = Array.from(line).length;
			const padding = Math.max(0, maxLength - length);
			if (textAlign === "right") {
				return `${" ".repeat(padding)}${line}`;
			}
			const leftPadding = Math.floor(padding / 2);
			return `${" ".repeat(leftPadding)}${line}`;
		})
		.join("\n");
};

const toEasing = (value: unknown): TransitionEasing => {
	return isTransitionEasing(value) ? value : "linear";
};

const getEasedProgressExpression = (progressExpression: string, easing: TransitionEasing): string => {
	switch (easing) {
		case "easeIn":
			return `pow(${progressExpression},2)`;
		case "easeOut":
			return `1-pow(1-${progressExpression},2)`;
		case "easeInOut":
			return `if(lt(${progressExpression},0.5),2*pow(${progressExpression},2),1-2*pow(1-${progressExpression},2))`;
		case "linear":
		default:
			return progressExpression;
	}
};

const parseBody = (body: unknown): { ok: true; value: RenderRequestBody } | { ok: false; error: string } => {
	if (!body || typeof body !== "object") {
		return { ok: false, error: "Invalid request body." };
	}

	const payload = body as Partial<RenderRequestBody>;
	if (!Array.isArray(payload.clips)) {
		return { ok: false, error: "clips(array) is required." };
	}

	if (payload.clips.length === 0) {
		return { ok: false, error: "No valid text clips found." };
	}

	if (payload.clips.length > MAX_CLIPS) {
		return { ok: false, error: `Too many clips. Maximum is ${MAX_CLIPS}.` };
	}

	return {
		ok: true,
		value: {
			clips: payload.clips as RenderTextClipInput[],
			fps: payload.fps,
			width: payload.width,
			height: payload.height,
			projectName: payload.projectName,
			backgroundColor: payload.backgroundColor,
		},
	};
};

const normalizeClips = (clips: RenderTextClipInput[]): NormalizedClip[] => {
	return clips
		.map((clip, index) => {
			const start = Math.max(0, toNumber(clip.start, 0));
			const length = Math.max(0.1, toNumber(clip.length, 1));
			const end = start + length;
			const zIndex = toNumber(clip.zIndex, index + 1);
			const fontSize = Math.max(12, Math.floor(toNumber(clip.fontSize, 64)));
			const fontFamily = toFontFamily(clip.fontFamily);
			const fontWeight = toFontWeight(clip.fontWeight, fontFamily);
			const textTransform = toTextTransformMode(clip.textTransform);
			const textAlign = toTextAlignMode(clip.textAlign);
			const strokeColor = isHexColor(clip.strokeColor) ? clip.strokeColor : "#000000";
			const strokeWidth = toStrokeWidth(clip.strokeWidth);
			const letterSpacingUnit = toLetterSpacingUnit(clip.letterSpacingUnit);
			const letterSpacing = toLetterSpacing(clip.letterSpacing, letterSpacingUnit);
			const letterSpacingPx = toLetterSpacingPx(letterSpacing, letterSpacingUnit, fontSize);
			const lineHeight = toLineHeight(clip.lineHeight);
			const opacity = toOpacity(clip.opacity);
			const shadowColor = isHexColor(clip.shadowColor) ? clip.shadowColor : "#000000";
			const shadowBlur = toShadowBlur(clip.shadowBlur);
			const shadowOffsetX = toShadowOffset(clip.shadowOffsetX);
			const shadowOffsetY = toShadowOffset(clip.shadowOffsetY);
			const shadowOpacity = toShadowOpacity(clip.shadowOpacity);
			const shadowEnabled = toShadowEnabled(clip.shadowEnabled);
			const glowColor = isHexColor(clip.glowColor) ? clip.glowColor : "#60a5fa";
			const glowStrength = toGlowStrength(clip.glowStrength);
			const glowEnabled = toGlowEnabled(clip.glowEnabled);
			const glowBlur = toGlowBlur(clip.glowBlur);
			const glowOpacity = toGlowOpacity(clip.glowOpacity);
			const backgroundColor = isHexColor(clip.backgroundColor) ? clip.backgroundColor : "#000000";
			const backgroundPaddingX = toBackgroundPaddingX(clip.backgroundPaddingX);
			const backgroundPaddingY = toBackgroundPaddingY(clip.backgroundPaddingY);
			const backgroundRadius = toBackgroundRadius(clip.backgroundRadius);
			const backgroundEnabled = toBackgroundEnabled(clip.backgroundEnabled);
			const backgroundOpacity = toBackgroundOpacity(clip.backgroundOpacity);
			const backgroundBorderColor = isHexColor(clip.backgroundBorderColor) ? clip.backgroundBorderColor : "#ffffff";
			const backgroundBorderWidth = toBackgroundBorderWidth(clip.backgroundBorderWidth);
			const x = Math.min(Math.max(toNumber(clip.positionX, 0.5), 0), 1);
			const y = Math.min(Math.max(toNumber(clip.positionY, 0.5), 0), 1);
			const anchorX = toAnchorXMode(clip.anchorX);
			const anchorY = toAnchorYMode(clip.anchorY);
			const inDuration = Math.min(length, Math.max(0, toNumber(clip.transitions?.inPoint?.duration, 0)));
			const outDuration = Math.min(length, Math.max(0, toNumber(clip.transitions?.outPoint?.duration, 0)));
			const inEasing = toEasing(clip.transitions?.inPoint?.easing);
			const outEasing = toEasing(clip.transitions?.outPoint?.easing);

			return {
				id: String(clip.id ?? `clip-${index + 1}`),
				text: String(clip.text ?? ""),
				start,
				end,
				length,
				zIndex,
				fontSize,
				fontFamily,
				fontWeight,
				textTransform,
				textAlign,
				strokeColor,
				strokeWidth,
				letterSpacing,
				letterSpacingUnit,
				letterSpacingPx,
				lineHeight,
				opacity,
				shadowColor,
				shadowBlur,
				shadowOffsetX,
				shadowOffsetY,
				shadowOpacity,
				shadowEnabled,
				glowColor,
				glowStrength,
				glowEnabled,
				glowBlur,
				glowOpacity,
				backgroundColor,
				backgroundPaddingX,
				backgroundPaddingY,
				backgroundRadius,
				backgroundEnabled,
				backgroundOpacity,
				backgroundBorderColor,
				backgroundBorderWidth,
				color: String(clip.color ?? "white"),
				x,
				y,
				anchorX,
				anchorY,
				inDuration,
				outDuration,
				inEasing,
				outEasing,
			};
		})
		.filter((clip) => clip.text.length > 0)
		.sort((a, b) => a.zIndex - b.zIndex);
};

const runFfmpeg = async (args: string[]): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		const processHandle = spawn("ffmpeg", args, {
			windowsHide: true,
		});

		let stderr = "";

		processHandle.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		processHandle.on("error", (error) => {
			reject(error);
		});

		processHandle.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(stderr || `ffmpeg exited with code ${code}`));
		});
	});
};

export async function POST(request: Request) {
	if (isGitHubPagesBuild) {
		return githubPagesUnavailableResponse();
	}

	const clientKey = getClientKey(request);
	const rateLimitResult = consumeRateLimit(clientKey);
	if (!rateLimitResult.allowed) {
		return NextResponse.json(
			{ error: "Too many render requests. Please retry later." },
			{
				status: 429,
				headers: {
					"Retry-After": String(rateLimitResult.retryAfterSeconds),
				},
			}
		);
	}

	if ((globalForRenderGuards.renderInFlightCount ?? 0) >= MAX_RENDER_CONCURRENCY) {
		return NextResponse.json(
			{ error: "Render queue is busy. Please retry in a moment." },
			{ status: 429 }
		);
	}

	const body = await request.json().catch(() => null);
	const parsed = parseBody(body);
	if (!parsed.ok) {
		return NextResponse.json({ error: parsed.error }, { status: 400 });
	}

	const width = Math.min(MAX_WIDTH, Math.max(320, Math.floor(toNumber(parsed.value.width, 1280))));
	const height = Math.min(MAX_HEIGHT, Math.max(180, Math.floor(toNumber(parsed.value.height, 720))));
	const fps = Math.min(MAX_FPS, Math.max(12, Math.floor(toNumber(parsed.value.fps, 30))));
	const backgroundColor = String(parsed.value.backgroundColor ?? "black");
	const normalizedClips = normalizeClips(parsed.value.clips);

	if (normalizedClips.length === 0) {
		return NextResponse.json({ error: "No valid text clips found." }, { status: 400 });
	}

	const totalTextLength = normalizedClips.reduce((sum, clip) => sum + clip.text.length, 0);
	if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
		return NextResponse.json(
			{ error: `Text is too long. Maximum total length is ${MAX_TOTAL_TEXT_LENGTH}.` },
			{ status: 400 }
		);
	}

	const duration = Math.max(
		1,
		normalizedClips.reduce((maxDuration, clip) => Math.max(maxDuration, clip.end), 0)
	);

	if (duration > MAX_DURATION_SECONDS) {
		return NextResponse.json(
			{ error: `Timeline is too long. Maximum duration is ${MAX_DURATION_SECONDS} seconds.` },
			{ status: 400 }
		);
	}

	const outputDir = path.join(process.cwd(), "public", "renders");
	await mkdir(outputDir, { recursive: true });

	const safeProjectName = (parsed.value.projectName ?? "text-project")
		.replace(/[^a-zA-Z0-9-_]/g, "-")
		.slice(0, 40);
	const fileName = `${safeProjectName || "text-project"}-${Date.now()}.mp4`;
	const outputPath = path.join(outputDir, fileName);

	const ffmpegArgs: string[] = [
		"-y",
		"-f",
		"lavfi",
		"-i",
		`color=c=${backgroundColor}:s=${width}x${height}:d=${duration}`,
	];

	let currentLabel = "base0";
	const filterParts: string[] = ["[0:v]format=yuv420p[base0]"];
	let hasNegativeLetterSpacing = false;
	let hasTextAlignApproximation = false;
	let hasShadowBlurApproximation = false;
	let hasGlowApproximation = false;
	let hasBackgroundRadiusApproximation = false;

	normalizedClips.forEach((clip, index) => {
		const fillLabel = `txt${index}`;
		if (clip.letterSpacingPx < -0.01) {
			hasNegativeLetterSpacing = true;
		}
		const transformedText = applyTextTransform(clip.text, clip.textTransform);
		const alignedText = applyTextAlignApproximation(transformedText, clip.textAlign);
		if (clip.textAlign !== "left") {
			hasTextAlignApproximation = true;
		}
		const approximatedText = applyLetterSpacingApproximation(alignedText, clip.letterSpacingPx);
		const escapedText = escapeDrawText(approximatedText);
		const fontPattern = `${clip.fontFamily}:style=${toFontStyleName(clip.fontWeight)}`;
		const escapedFontPattern = escapeDrawText(fontPattern);
		const lineSpacing = Math.max(0, Math.round(clip.fontSize * (clip.lineHeight - 1)));
		const xExpression =
			clip.anchorX === "left"
				? `(w*${clip.x.toFixed(3)}-text_w)`
				: clip.anchorX === "right"
					? `(w*${clip.x.toFixed(3)})`
					: `(w*${clip.x.toFixed(3)}-text_w/2)`;
		const yExpression =
			clip.anchorY === "top"
				? `(h*${clip.y.toFixed(3)}-text_h)`
				: clip.anchorY === "bottom"
					? `(h*${clip.y.toFixed(3)})`
					: `(h*${clip.y.toFixed(3)}-text_h/2)`;
		const inEnd = clip.start + clip.inDuration;
		const outStart = clip.end - clip.outDuration;
		const inProgress = `(t-${clip.start.toFixed(3)})/${Math.max(clip.inDuration, 0.001).toFixed(3)}`;
		const outProgress = `(t-${outStart.toFixed(3)})/${Math.max(clip.outDuration, 0.001).toFixed(3)}`;
		const inAlpha = getEasedProgressExpression(inProgress, clip.inEasing);
		const outAlpha = `1-(${getEasedProgressExpression(outProgress, clip.outEasing)})`;

		const alphaExpression =
			clip.inDuration > 0 || clip.outDuration > 0
				? `if(lt(t,${inEnd.toFixed(3)}),${inAlpha},if(gt(t,${outStart.toFixed(3)}),${outAlpha},1))`
				: "1";
		const effectiveAlphaExpression =
			clip.opacity >= 0.999 ? alphaExpression : `(${alphaExpression})*${clip.opacity.toFixed(3)}`;
		const backgroundAlphaExpression =
			clip.backgroundOpacity >= 0.999
				? alphaExpression
				: `(${alphaExpression})*${clip.backgroundOpacity.toFixed(3)}`;
		if (clip.shadowEnabled && clip.shadowBlur > 0) {
			hasShadowBlurApproximation = true;
		}
		if (clip.glowEnabled) {
			hasGlowApproximation = true;
		}
		if (clip.backgroundEnabled && clip.backgroundRadius > 0) {
			hasBackgroundRadiusApproximation = true;
		}
		const shadowOptions =
			clip.glowEnabled && clip.glowOpacity > 0 && clip.glowStrength > 0
				? `:shadowcolor=${clip.glowColor}@${clip.glowOpacity.toFixed(3)}:shadowx=0:shadowy=0`
				: clip.shadowEnabled && clip.shadowOpacity > 0
					? `:shadowcolor=${clip.shadowColor}@${clip.shadowOpacity.toFixed(3)}:shadowx=${clip.shadowOffsetX.toFixed(2)}:shadowy=${clip.shadowOffsetY.toFixed(2)}`
					: ":shadowcolor=#000000@0:shadowx=0:shadowy=0";
		let textInputLabel = currentLabel;
		if (clip.backgroundEnabled && (clip.backgroundOpacity > 0 || clip.backgroundBorderWidth > 0)) {
			const bgFillLabel = `txt${index}bgf`;
			const bgInnerPad = `${clip.backgroundPaddingY.toFixed(2)}|${clip.backgroundPaddingX.toFixed(2)}|${clip.backgroundPaddingY.toFixed(2)}|${clip.backgroundPaddingX.toFixed(2)}`;
			if (clip.backgroundBorderWidth > 0) {
				const bgBorderLabel = `txt${index}bgb`;
				const outerPadY = clip.backgroundPaddingY + clip.backgroundBorderWidth;
				const outerPadX = clip.backgroundPaddingX + clip.backgroundBorderWidth;
				const bgOuterPad = `${outerPadY.toFixed(2)}|${outerPadX.toFixed(2)}|${outerPadY.toFixed(2)}|${outerPadX.toFixed(2)}`;
				filterParts.push(
					`[${currentLabel}]drawtext=text='${escapedText}':font='${escapedFontPattern}':fontsize=${clip.fontSize}:fontcolor=white@0:box=1:boxcolor=${clip.backgroundBorderColor}:boxborderw=${bgOuterPad}:x=${xExpression}:y=${yExpression}:alpha='${backgroundAlphaExpression}':enable='between(t,${clip.start.toFixed(3)},${clip.end.toFixed(3)})'[${bgBorderLabel}]`
				);
				filterParts.push(
					`[${bgBorderLabel}]drawtext=text='${escapedText}':font='${escapedFontPattern}':fontsize=${clip.fontSize}:fontcolor=white@0:box=1:boxcolor=${clip.backgroundColor}:boxborderw=${bgInnerPad}:x=${xExpression}:y=${yExpression}:alpha='${backgroundAlphaExpression}':enable='between(t,${clip.start.toFixed(3)},${clip.end.toFixed(3)})'[${bgFillLabel}]`
				);
			} else {
				filterParts.push(
					`[${currentLabel}]drawtext=text='${escapedText}':font='${escapedFontPattern}':fontsize=${clip.fontSize}:fontcolor=white@0:box=1:boxcolor=${clip.backgroundColor}:boxborderw=${bgInnerPad}:x=${xExpression}:y=${yExpression}:alpha='${backgroundAlphaExpression}':enable='between(t,${clip.start.toFixed(3)},${clip.end.toFixed(3)})'[${bgFillLabel}]`
				);
			}
			textInputLabel = bgFillLabel;
		}

		if (clip.strokeWidth > 0) {
			const strokeLabel = `txt${index}s`;
			filterParts.push(
				`[${textInputLabel}]drawtext=text='${escapedText}':font='${escapedFontPattern}':fontsize=${clip.fontSize}:fontcolor=white@0:bordercolor=${clip.strokeColor}:borderw=${(clip.strokeWidth * 2).toFixed(2)}:line_spacing=${lineSpacing}:x=${xExpression}:y=${yExpression}:alpha='${effectiveAlphaExpression}':enable='between(t,${clip.start.toFixed(3)},${clip.end.toFixed(3)})'[${strokeLabel}]`
			);
			filterParts.push(
				`[${strokeLabel}]drawtext=text='${escapedText}':font='${escapedFontPattern}':fontsize=${clip.fontSize}:fontcolor=${clip.color}:borderw=0${shadowOptions}:line_spacing=${lineSpacing}:x=${xExpression}:y=${yExpression}:alpha='${effectiveAlphaExpression}':enable='between(t,${clip.start.toFixed(3)},${clip.end.toFixed(3)})'[${fillLabel}]`
			);
		} else {
			filterParts.push(
				`[${textInputLabel}]drawtext=text='${escapedText}':font='${escapedFontPattern}':fontsize=${clip.fontSize}:fontcolor=${clip.color}:borderw=0${shadowOptions}:line_spacing=${lineSpacing}:x=${xExpression}:y=${yExpression}:alpha='${effectiveAlphaExpression}':enable='between(t,${clip.start.toFixed(3)},${clip.end.toFixed(3)})'[${fillLabel}]`
			);
		}

		currentLabel = fillLabel;
	});

	ffmpegArgs.push(
		"-filter_complex",
		filterParts.join(";"),
		"-map",
		`[${currentLabel}]`,
		"-r",
		String(fps),
		"-t",
		duration.toFixed(3),
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		outputPath
	);

	globalForRenderGuards.renderInFlightCount = (globalForRenderGuards.renderInFlightCount ?? 0) + 1;

	try {
		await runFfmpeg(ffmpegArgs);
		const notes: string[] = [];
		if (hasNegativeLetterSpacing) {
			notes.push("Negative letter spacing is not directly supported by FFmpeg drawtext and is only approximated.");
		}
		if (hasTextAlignApproximation) {
			notes.push("Center/Right multiline alignment is approximated in export output.");
		}
		if (hasShadowBlurApproximation) {
			notes.push("Shadow blur is not directly supported by FFmpeg drawtext and is approximated without blur.");
		}
		if (hasGlowApproximation) {
			notes.push("Glow is approximated using FFmpeg drawtext shadow settings and does not fully match editor glow blur/spread.");
		}
		if (hasBackgroundRadiusApproximation) {
			notes.push("Background corner radius is not directly supported by FFmpeg drawtext box and is approximated as square corners.");
		}
		return NextResponse.json(
			{
				ok: true,
				fileName,
				url: `/renders/${fileName}`,
				command: process.env.NODE_ENV === "development" ? `ffmpeg ${ffmpegArgs.join(" ")}` : undefined,
				notes,
			},
			{ status: 200 }
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to render video.";
		const notInstalled = /ENOENT|not recognized|not found/i.test(message);
		return NextResponse.json(
			{
				error: notInstalled
					? "FFmpeg is not installed or not in PATH. Please install FFmpeg and retry."
					: "Failed to render video.",
			},
			{ status: 500 }
		);
	} finally {
		globalForRenderGuards.renderInFlightCount = Math.max(
			0,
			(globalForRenderGuards.renderInFlightCount ?? 1) - 1
		);
	}
}
