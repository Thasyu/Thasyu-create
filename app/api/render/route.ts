import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TransitionType = "none" | "fade" | "dissolve" | "slide" | "glitch" | "pixelate" | "rgbShift";

type RenderTextClipInput = {
	id: string;
	text: string;
	start: number;
	length: number;
	zIndex?: number;
	track?: number;
	fontSize?: number;
	color?: string;
	positionX?: number;
	positionY?: number;
	transitions?: {
		inPoint?: { duration?: number; effect?: TransitionType };
		outPoint?: { duration?: number; effect?: TransitionType };
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
	color: string;
	x: number;
	y: number;
	inDuration: number;
	outDuration: number;
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

const parseBody = (body: unknown): { ok: true; value: RenderRequestBody } | { ok: false; error: string } => {
	if (!body || typeof body !== "object") {
		return { ok: false, error: "Invalid request body." };
	}

	const payload = body as Partial<RenderRequestBody>;
	if (!Array.isArray(payload.clips)) {
		return { ok: false, error: "clips(array) is required." };
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
			const x = Math.min(Math.max(toNumber(clip.positionX, 0.5), 0), 1);
			const y = Math.min(Math.max(toNumber(clip.positionY, 0.5), 0), 1);
			const inDuration = Math.min(length, Math.max(0, toNumber(clip.transitions?.inPoint?.duration, 0)));
			const outDuration = Math.min(length, Math.max(0, toNumber(clip.transitions?.outPoint?.duration, 0)));

			return {
				id: String(clip.id ?? `clip-${index + 1}`),
				text: String(clip.text ?? ""),
				start,
				end,
				length,
				zIndex,
				fontSize,
				color: String(clip.color ?? "white"),
				x,
				y,
				inDuration,
				outDuration,
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
	const body = await request.json().catch(() => null);
	const parsed = parseBody(body);
	if (!parsed.ok) {
		return NextResponse.json({ error: parsed.error }, { status: 400 });
	}

	const width = Math.max(320, Math.floor(toNumber(parsed.value.width, 1280)));
	const height = Math.max(180, Math.floor(toNumber(parsed.value.height, 720)));
	const fps = Math.max(12, Math.floor(toNumber(parsed.value.fps, 30)));
	const backgroundColor = String(parsed.value.backgroundColor ?? "black");
	const normalizedClips = normalizeClips(parsed.value.clips);

	if (normalizedClips.length === 0) {
		return NextResponse.json({ error: "No valid text clips found." }, { status: 400 });
	}

	const duration = Math.max(
		1,
		normalizedClips.reduce((maxDuration, clip) => Math.max(maxDuration, clip.end), 0)
	);

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

	normalizedClips.forEach((clip, index) => {
		const nextLabel = `txt${index}`;
		const escapedText = escapeDrawText(clip.text);
		const xExpression = `(w-text_w)*${clip.x.toFixed(3)}`;
		const yExpression = `(h-text_h)*${clip.y.toFixed(3)}`;
		const inEnd = clip.start + clip.inDuration;
		const outStart = clip.end - clip.outDuration;

		const alphaExpression =
			clip.inDuration > 0 || clip.outDuration > 0
				? `if(lt(t,${inEnd.toFixed(3)}),(t-${clip.start.toFixed(3)})/${Math.max(clip.inDuration, 0.001).toFixed(3)},if(gt(t,${outStart.toFixed(3)}),(${clip.end.toFixed(3)}-t)/${Math.max(clip.outDuration, 0.001).toFixed(3)},1))`
				: "1";

		filterParts.push(
			`[${currentLabel}]drawtext=text='${escapedText}':fontsize=${clip.fontSize}:fontcolor=${clip.color}:x=${xExpression}:y=${yExpression}:alpha='${alphaExpression}':enable='between(t,${clip.start.toFixed(3)},${clip.end.toFixed(3)})'[${nextLabel}]`
		);
		currentLabel = nextLabel;
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

	try {
		await runFfmpeg(ffmpegArgs);
		return NextResponse.json(
			{
				ok: true,
				fileName,
				url: `/renders/${fileName}`,
				command: `ffmpeg ${ffmpegArgs.join(" ")}`,
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
					: message,
			},
			{ status: 500 }
		);
	}
}
