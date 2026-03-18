"use client";

import {
	CSSProperties,
	ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	DndContext,
	DragEndEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
	readEditorClips,
	readEditorSelectedClipId,
	writeEditorClips,
	writeEditorSelectedClipId,
} from "@/lib/editorClipStorage";

type TransitionType = "none" | "fade" | "slide" | "pixelate" | "rgbShift";
type TransitionEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";
type AccentEffect = "none" | "glitch";
type LegacyRgbShiftChannelMapping = "r-gb" | "rg-b" | "r-g-b";
type LetterSpacingUnit = "px" | "em";
type TextAlignMode = "left" | "center" | "right";
type TextTransformMode = "none" | "uppercase" | "lowercase";
type AnchorXMode = "left" | "center" | "right";
type AnchorYMode = "top" | "middle" | "bottom";

type ClipTransitionPoint = {
	duration: number;
	effect: TransitionType;
	easing: TransitionEasing;
	slideX: number;
	slideY: number;
	glitchIntensity: number;
	glitchSpeed: number;
	glitchChromaticAberration: number;
	glitchCharacterChaos: boolean;
	pixelateMaxSize: number;
	pixelateResolution: number;
	rgbShiftAngle: number;
	rgbShiftOffset: number;
	rgbShiftColorA: string;
	rgbShiftColorB: string;
};

type ClipTransitions = {
	inPoint: ClipTransitionPoint;
	outPoint: ClipTransitionPoint;
};

type ClipAccent = {
	effect: AccentEffect;
	triggerTime: number;
	duration: number;
	intensity: number;
};

type TextAsset = {
	id: string;
	name: string;
	text: string;
	color: string;
	fontSize: number;
};

type ClipItem = {
	id: string;
	assetId: string;
	name: string;
	text: string;
	start: number;
	length: number;
	track: number;
	zIndex: number;
	color: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: number;
		textTransform: TextTransformMode;
	textAlign: TextAlignMode;
	strokeColor: string;
	strokeWidth: number;
	letterSpacing: number;
	letterSpacingUnit: LetterSpacingUnit;
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
	positionX: number;
	positionY: number;
	anchorX: AnchorXMode;
	anchorY: AnchorYMode;
	transitions: ClipTransitions;
	accent: ClipAccent;
};

type TrimEdge = "start" | "end";

type TrimState = {
	clipId: string;
	edge: TrimEdge;
	startX: number;
	originStart: number;
	originLength: number;
};

type ActiveRenderClip = {
	clip: ClipItem;
	localTime: number;
};

type LayerState = {
	activeClips: ActiveRenderClip[];
};

type ProjectRecord = {
	id: number;
	title: string;
	content: string;
	updatedAt: string;
};

type ProjectEditorContent = {
	clips: ClipItem[];
	selectedClipId: string;
};

const FPS = 30;
const PIXELS_PER_SECOND = 80;
const TRACK_COUNT = 4;
const MIN_CLIP_LENGTH = 0.25;

const textAssets: TextAsset[] = [
	{ id: "asset-title", name: "Title", text: "NEW EPISODE", color: "#ffffff", fontSize: 82 },
	{ id: "asset-sub", name: "Subtitle", text: "Powered by Character Transitions", color: "#7dd3fc", fontSize: 44 },
	{ id: "asset-call", name: "Callout", text: "LIMITED TIME", color: "#fca5a5", fontSize: 64 },
];

const initialClips: ClipItem[] = [];

const createInitialProjectContent = (): ProjectEditorContent => ({
	clips: [],
	selectedClipId: "",
});

const parseProjectEditorContent = (content: string): ProjectEditorContent => {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (Array.isArray(parsed)) {
			return {
				clips: parsed.map((clip) => normalizeClip(clip as ClipItem)),
				selectedClipId: "",
			};
		}

		if (parsed && typeof parsed === "object") {
			const record = parsed as { clips?: unknown; selectedClipId?: unknown };
			const parsedClips = Array.isArray(record.clips)
				? record.clips.map((clip) => normalizeClip(clip as ClipItem))
				: [];
			return {
				clips: parsedClips,
				selectedClipId: typeof record.selectedClipId === "string" ? record.selectedClipId : "",
			};
		}
	} catch {
		return createInitialProjectContent();
	}

	return createInitialProjectContent();
};

const stringifyProjectEditorContent = (content: ProjectEditorContent): string => {
	return JSON.stringify({
		clips: content.clips.map(normalizeClip),
		selectedClipId: content.selectedClipId,
	});
};

const effectCodeMap: Record<TransitionType, number> = {
	none: 0,
	fade: 1,
	slide: 2,
	pixelate: 4,
	rgbShift: 5,
};

const transitionTypes: TransitionType[] = ["none", "fade", "slide", "pixelate", "rgbShift"];
const transitionEasingTypes: TransitionEasing[] = ["linear", "easeIn", "easeOut", "easeInOut"];
const accentEffects: AccentEffect[] = ["none", "glitch"];
const rgbShiftLegacyChannelMappings: LegacyRgbShiftChannelMapping[] = ["r-gb", "rg-b", "r-g-b"];
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
];
const availableFontSet = new Set(availableFonts);
const defaultFontFamily = "Inter";
const fontWeightOptions = [300, 400, 500, 700, 900] as const;
type FontWeightValue = (typeof fontWeightOptions)[number];
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

const isTransitionType = (value: unknown): value is TransitionType => {
	return transitionTypes.includes(value as TransitionType);
};

const isTransitionEasing = (value: unknown): value is TransitionEasing => {
	return transitionEasingTypes.includes(value as TransitionEasing);
};

const isAccentEffect = (value: unknown): value is AccentEffect => {
	return accentEffects.includes(value as AccentEffect);
};

const isLegacyRgbShiftChannelMapping = (value: unknown): value is LegacyRgbShiftChannelMapping => {
	return rgbShiftLegacyChannelMappings.includes(value as LegacyRgbShiftChannelMapping);
};

const isHexColor = (value: unknown): value is string => {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
};

const isLetterSpacingUnit = (value: unknown): value is LetterSpacingUnit => {
	return value === "px" || value === "em";
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

const toFontFamily = (value: unknown): string => {
	if (typeof value !== "string") {
		return defaultFontFamily;
	}
	return availableFontSet.has(value) ? value : defaultFontFamily;
};

const getSupportedFontWeights = (fontFamily: string): readonly FontWeightValue[] => {
	return fontWeightsByFamily[fontFamily] ?? fontWeightOptions;
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

const toLetterSpacingUnit = (value: unknown): LetterSpacingUnit => {
	return isLetterSpacingUnit(value) ? value : "em";
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

const toLetterSpacing = (value: unknown, unit: LetterSpacingUnit): number => {
	const numeric = toFiniteNumber(value, 0);
	if (unit === "em") {
		return clamp(numeric, -0.1, 1);
	}
	return clamp(numeric, -10, 160);
};

const toLineHeight = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 1.2), 0, 2);
};

const toStrokeWidth = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 0), 0, 5);
};

const toOpacity = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 1), 0, 1);
};

const toShadowBlur = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 14), 0, 100);
};

const toShadowOffset = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 0), -200, 200);
};

const toShadowOpacity = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 0.45), 0, 1);
};

const toShadowEnabled = (value: unknown): boolean => {
	if (typeof value === "boolean") {
		return value;
	}
	return true;
};

const toGlowStrength = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 1), 0, 5);
};

const toGlowBlur = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 24), 0, 120);
};

const toGlowOpacity = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 0.7), 0, 1);
};

const toGlowEnabled = (value: unknown): boolean => {
	if (typeof value === "boolean") {
		return value;
	}
	return false;
};

const toBackgroundPaddingX = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 16), 0, 200);
};

const toBackgroundPaddingY = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 8), 0, 200);
};

const toBackgroundRadius = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 12), 0, 200);
};

const toBackgroundEnabled = (value: unknown): boolean => {
	if (typeof value === "boolean") {
		return value;
	}
	return false;
};

const toBackgroundOpacity = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 0.55), 0, 1);
};

const toBackgroundBorderWidth = (value: unknown): number => {
	return clamp(toFiniteNumber(value, 0), 0, 20);
};

const isSlideDirection = (value: unknown): value is "left" | "right" | "up" | "down" => {
	return value === "left" || value === "right" || value === "up" || value === "down";
};

const clamp = (value: number, min: number, max: number): number => {
	return Math.min(Math.max(value, min), max);
};

const toFiniteNumber = (value: unknown, fallback: number): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const clampRatio = (value: number): number => {
	return clamp(value, 0, 1);
};

const clampGlitchIntensity = (value: number): number => {
	return clamp(value, 0, 1);
};

const clampGlitchSpeed = (value: number): number => {
	return clamp(value, 0.1, 100);
};

const clampGlitchChromaticAberration = (value: number): number => {
	return clamp(value, 0, 20);
};

const clampPixelateMaxSize = (value: number): number => {
	return clamp(value, 1, 100);
};

const clampPixelateResolution = (value: number): number => {
	return clamp(value, 0, 1);
};

const clampRgbShiftAngle = (value: number): number => {
	const normalized = toFiniteNumber(value, 0) % 360;
	return normalized < 0 ? normalized + 360 : normalized;
};

const clampRgbShiftOffset = (value: number): number => {
	return clamp(value, 0, 50);
};

const getRgbShiftLegacyColors = (mapping: unknown): { colorA: string; colorB: string } => {
	if (!isLegacyRgbShiftChannelMapping(mapping)) {
		return { colorA: "#ff005a", colorB: "#00e1ff" };
	}

	switch (mapping) {
		case "rg-b":
			return { colorA: "#ffdc5a", colorB: "#4682ff" };
		case "r-g-b":
			return { colorA: "#ff5a5a", colorB: "#508cff" };
		case "r-gb":
		default:
			return { colorA: "#ff005a", colorB: "#00e1ff" };
	}
};

const quantizeToStep = (value: number, step: number): number => {
	if (step <= 0) {
		return value;
	}
	return Math.round(value / step) * step;
};

const drawRoundedRect = (
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
): void => {
	const safeWidth = Math.max(0, width);
	const safeHeight = Math.max(0, height);
	const safeRadius = Math.min(Math.max(0, radius), safeWidth / 2, safeHeight / 2);
	context.beginPath();
	if (safeRadius <= 0) {
		context.rect(x, y, safeWidth, safeHeight);
		return;
	}
	context.moveTo(x + safeRadius, y);
	context.lineTo(x + safeWidth - safeRadius, y);
	context.quadraticCurveTo(x + safeWidth, y, x + safeWidth, y + safeRadius);
	context.lineTo(x + safeWidth, y + safeHeight - safeRadius);
	context.quadraticCurveTo(x + safeWidth, y + safeHeight, x + safeWidth - safeRadius, y + safeHeight);
	context.lineTo(x + safeRadius, y + safeHeight);
	context.quadraticCurveTo(x, y + safeHeight, x, y + safeHeight - safeRadius);
	context.lineTo(x, y + safeRadius);
	context.quadraticCurveTo(x, y, x + safeRadius, y);
};

const getSlidePointByDirection = (
	direction: "left" | "right" | "up" | "down",
	anchorX: number,
	anchorY: number
): { x: number; y: number } => {
	switch (direction) {
		case "left":
			return { x: 0, y: anchorY };
		case "right":
			return { x: 1, y: anchorY };
		case "up":
			return { x: anchorX, y: 0 };
		case "down":
		default:
			return { x: anchorX, y: 1 };
	}
};

const applyEasing = (progress: number, easing: TransitionEasing): number => {
	const t = clamp(progress, 0, 1);
	switch (easing) {
		case "easeIn":
			return t * t;
		case "easeOut":
			return 1 - (1 - t) * (1 - t);
		case "easeInOut":
			return t < 0.5 ? 2 * t * t : 1 - (Math.pow(-2 * t + 2, 2) / 2);
		case "linear":
		default:
			return t;
	}
};

const getEasedTransitionIntensity = (
	intensity: number,
	source: "in" | "out",
	easing: TransitionEasing
): number => {
	const progress = source === "in" ? 1 - intensity : intensity;
	const easedProgress = applyEasing(progress, easing);
	return source === "in" ? 1 - easedProgress : easedProgress;
};

const getAccentGlitchIntensityAtTime = (accent: ClipAccent, localTime: number): number => {
	if (accent.effect !== "glitch" || accent.duration <= 0) {
		return 0;
	}

	const end = accent.triggerTime + accent.duration;
	if (localTime < accent.triggerTime || localTime > end) {
		return 0;
	}

	const progress = clamp((localTime - accent.triggerTime) / Math.max(accent.duration, 0.001), 0, 1);
	return Math.sin(Math.PI * progress) * clampGlitchIntensity(accent.intensity);
};

const quantizeQuarter = (value: number): number => {
	return Math.round(value * 4) / 4;
};

const lerp = (start: number, end: number, progress: number): number => {
	return start + (end - start) * progress;
};

const hexToRgba = (hexColor: string, alpha: number): string => {
	const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
	if (!match) {
		return `rgba(255,255,255,${alpha})`;
	}
	return `rgba(${Number.parseInt(match[1], 16)},${Number.parseInt(match[2], 16)},${Number.parseInt(match[3], 16)},${alpha})`;
};

const getRgbShiftShadow = (
	offsetX: number,
	offsetY: number,
	colorA: string,
	colorB: string,
	alpha = 0.72
): string => {
	const glow = "0 2px 10px rgba(0,0,0,0.55)";
	const dx = offsetX.toFixed(2);
	const dy = offsetY.toFixed(2);
	const ndx = (-offsetX).toFixed(2);
	const ndy = (-offsetY).toFixed(2);
	const primaryColor = colorA;
	const secondaryColor = colorB;
	return `${dx}px ${dy}px ${hexToRgba(primaryColor, alpha)}, ${ndx}px ${ndy}px ${hexToRgba(secondaryColor, alpha)}, ${glow}`;
};

const normalizeTransitionPoint = (
	point: unknown,
	source: "in" | "out",
	anchorX: number,
	anchorY: number
): ClipTransitionPoint => {
	const rawPoint = point && typeof point === "object" ? (point as Record<string, unknown>) : {};
	const effectValue = rawPoint.effect;
	const normalizedEffect = effectValue === "dissolve" ? "fade" : effectValue === "glitch" ? "none" : effectValue;
	const easingValue = rawPoint.easing;
	const legacyRgbShiftMappingValue = rawPoint.rgbShiftChannelMapping;
	const legacyRgbColors = getRgbShiftLegacyColors(legacyRgbShiftMappingValue);
	const directionValue = rawPoint.slideDirection;
	const normalizedDirection = isSlideDirection(directionValue) ? directionValue : "left";
	const presetPoint = getSlidePointByDirection(normalizedDirection, anchorX, anchorY);
	const legacyOffsetX = source === "in" ? rawPoint.slideOffsetStartX : rawPoint.slideOffsetEndX;
	const legacyOffsetY = source === "in" ? rawPoint.slideOffsetStartY : rawPoint.slideOffsetEndY;
	const slideXFallback = anchorX + toFiniteNumber(legacyOffsetX, presetPoint.x - anchorX);
	const slideYFallback = anchorY + toFiniteNumber(legacyOffsetY, presetPoint.y - anchorY);
	return {
		duration: Math.max(0, toFiniteNumber(rawPoint.duration, 0)),
		effect: isTransitionType(normalizedEffect) ? normalizedEffect : "none",
		easing: isTransitionEasing(easingValue) ? easingValue : "linear",
		slideX: clampRatio(toFiniteNumber(rawPoint.slideX, slideXFallback)),
		slideY: clampRatio(toFiniteNumber(rawPoint.slideY, slideYFallback)),
		glitchIntensity: clampGlitchIntensity(toFiniteNumber(rawPoint.glitchIntensity, 0.65)),
		glitchSpeed: clampGlitchSpeed(toFiniteNumber(rawPoint.glitchSpeed, 24)),
		glitchChromaticAberration: clampGlitchChromaticAberration(toFiniteNumber(rawPoint.glitchChromaticAberration, 6)),
		glitchCharacterChaos: Boolean(rawPoint.glitchCharacterChaos),
		pixelateMaxSize: clampPixelateMaxSize(toFiniteNumber(rawPoint.pixelateMaxSize, 48)),
		pixelateResolution: clampPixelateResolution(toFiniteNumber(rawPoint.pixelateResolution, 0.45)),
		rgbShiftAngle: clampRgbShiftAngle(toFiniteNumber(rawPoint.rgbShiftAngle, 0)),
		rgbShiftOffset: clampRgbShiftOffset(toFiniteNumber(rawPoint.rgbShiftOffset, 24)),
		rgbShiftColorA: isHexColor(rawPoint.rgbShiftColorA) ? rawPoint.rgbShiftColorA : legacyRgbColors.colorA,
		rgbShiftColorB: isHexColor(rawPoint.rgbShiftColorB) ? rawPoint.rgbShiftColorB : legacyRgbColors.colorB,
	};
};

const normalizeAccentByLength = (accent: unknown, length: number): ClipAccent => {
	const rawAccent = accent && typeof accent === "object" ? (accent as Record<string, unknown>) : {};
	const triggerTime = clamp(toFiniteNumber(rawAccent.triggerTime, 0), 0, length);
	const maxDuration = Math.max(0, length - triggerTime);
	return {
		effect: isAccentEffect(rawAccent.effect) ? rawAccent.effect : "none",
		triggerTime,
		duration: clamp(toFiniteNumber(rawAccent.duration, 0.2), 0, maxDuration),
		intensity: clampGlitchIntensity(toFiniteNumber(rawAccent.intensity, 0.8)),
	};
};

const normalizeTransitionsByLength = (transitions: ClipTransitions, length: number): ClipTransitions => {
	const inDuration = clamp(transitions.inPoint.duration, 0, length);
	const outDuration = clamp(transitions.outPoint.duration, 0, length);
	const total = inDuration + outDuration;

	if (total <= length || total === 0) {
		return {
			inPoint: { ...transitions.inPoint, duration: inDuration, easing: transitions.inPoint.easing ?? "linear" },
			outPoint: { ...transitions.outPoint, duration: outDuration, easing: transitions.outPoint.easing ?? "linear" },
		};
	}

	const scale = length / total;
	return {
		inPoint: {
			...transitions.inPoint,
			duration: Number((inDuration * scale).toFixed(3)),
			easing: transitions.inPoint.easing ?? "linear",
		},
		outPoint: {
			...transitions.outPoint,
			duration: Number((outDuration * scale).toFixed(3)),
			easing: transitions.outPoint.easing ?? "linear",
		},
	};
};

const normalizeClip = (clip: ClipItem): ClipItem => {
	const normalizedLength = Math.max(toFiniteNumber(clip.length, MIN_CLIP_LENGTH), MIN_CLIP_LENGTH);
	const normalizedPositionX = clamp(toFiniteNumber(clip.positionX, 0.5), 0, 1);
	const normalizedPositionY = clamp(toFiniteNumber(clip.positionY, 0.5), 0, 1);
	const normalizedFontFamily = toFontFamily(clip.fontFamily);
	const normalizedLetterSpacingUnit = toLetterSpacingUnit(clip.letterSpacingUnit);
	const normalizedTextAlign = toTextAlignMode(clip.textAlign);
	const normalizedTextTransform = toTextTransformMode(clip.textTransform);
	const normalizedAnchorX = toAnchorXMode(clip.anchorX);
	const normalizedAnchorY = toAnchorYMode(clip.anchorY);
	const rawTransitions = clip.transitions && typeof clip.transitions === "object" ? clip.transitions : ({} as ClipTransitions);
	const rawAccent = clip.accent && typeof clip.accent === "object" ? clip.accent : {};
	return {
		...clip,
		length: normalizedLength,
		fontFamily: normalizedFontFamily,
		fontWeight: toFontWeight(clip.fontWeight, normalizedFontFamily),
		textTransform: normalizedTextTransform,
		textAlign: normalizedTextAlign,
		strokeColor: isHexColor(clip.strokeColor) ? clip.strokeColor : "#000000",
		strokeWidth: toStrokeWidth(clip.strokeWidth),
		letterSpacingUnit: normalizedLetterSpacingUnit,
		letterSpacing: toLetterSpacing(clip.letterSpacing, normalizedLetterSpacingUnit),
		lineHeight: toLineHeight(clip.lineHeight),
		opacity: toOpacity(clip.opacity),
		shadowColor: isHexColor(clip.shadowColor) ? clip.shadowColor : "#000000",
		shadowBlur: toShadowBlur(clip.shadowBlur),
		shadowOffsetX: toShadowOffset(clip.shadowOffsetX),
		shadowOffsetY: toShadowOffset(clip.shadowOffsetY),
		shadowOpacity: toShadowOpacity(clip.shadowOpacity),
		shadowEnabled: toShadowEnabled(clip.shadowEnabled),
		glowColor: isHexColor(clip.glowColor) ? clip.glowColor : "#60a5fa",
		glowStrength: toGlowStrength(clip.glowStrength),
		glowEnabled: toGlowEnabled(clip.glowEnabled),
		glowBlur: toGlowBlur(clip.glowBlur),
		glowOpacity: toGlowOpacity(clip.glowOpacity),
		backgroundColor: isHexColor(clip.backgroundColor) ? clip.backgroundColor : "#000000",
		backgroundPaddingX: toBackgroundPaddingX(clip.backgroundPaddingX),
		backgroundPaddingY: toBackgroundPaddingY(clip.backgroundPaddingY),
		backgroundRadius: toBackgroundRadius(clip.backgroundRadius),
		backgroundEnabled: toBackgroundEnabled(clip.backgroundEnabled),
		backgroundOpacity: toBackgroundOpacity(clip.backgroundOpacity),
		backgroundBorderColor: isHexColor(clip.backgroundBorderColor) ? clip.backgroundBorderColor : "#ffffff",
		backgroundBorderWidth: toBackgroundBorderWidth(clip.backgroundBorderWidth),
		positionX: normalizedPositionX,
		positionY: normalizedPositionY,
		anchorX: normalizedAnchorX,
		anchorY: normalizedAnchorY,
		transitions: normalizeTransitionsByLength(
			{
				inPoint: normalizeTransitionPoint(rawTransitions.inPoint, "in", normalizedPositionX, normalizedPositionY),
				outPoint: normalizeTransitionPoint(rawTransitions.outPoint, "out", normalizedPositionX, normalizedPositionY),
			},
			normalizedLength
		),
		accent: normalizeAccentByLength(rawAccent, normalizedLength),
	};
};

const getTransitionProgress = (clip: ClipItem, currentTime: number): number => {
	const localTime = currentTime - clip.start;
	const inDuration = clip.transitions.inPoint.duration;
	const outDuration = clip.transitions.outPoint.duration;
	const inStrength = inDuration > 0 ? clamp((inDuration - localTime) / inDuration, 0, 1) : 0;
	const outStrength = outDuration > 0 ? clamp((localTime - (clip.length - outDuration)) / outDuration, 0, 1) : 0;
	const inWeighted = clip.transitions.inPoint.effect === "none" ? 0 : inStrength;
	const outWeighted = clip.transitions.outPoint.effect === "none" ? 0 : outStrength;
	return clamp(Math.max(inWeighted, outWeighted), 0, 1);
};

const resolveActiveTransitionEffect = (clip: ClipItem, currentTime: number): TransitionType => {
	const localTime = currentTime - clip.start;

	if (
		clip.transitions.inPoint.effect !== "none" &&
		clip.transitions.inPoint.duration > 0 &&
		localTime <= clip.transitions.inPoint.duration
	) {
		return clip.transitions.inPoint.effect;
	}

	if (
		clip.transitions.outPoint.effect !== "none" &&
		clip.transitions.outPoint.duration > 0 &&
		localTime >= clip.length - clip.transitions.outPoint.duration
	) {
		return clip.transitions.outPoint.effect;
	}

	return "none";
};

const getClipTransitionState = (clip: ClipItem, localTime: number) => {
	const inDuration = clip.transitions.inPoint.duration;
	const outDuration = clip.transitions.outPoint.duration;
	const inIntensity =
		clip.transitions.inPoint.effect !== "none" && inDuration > 0 ? clamp((inDuration - localTime) / inDuration, 0, 1) : 0;
	const outIntensity =
		clip.transitions.outPoint.effect !== "none" && outDuration > 0
			? clamp((localTime - (clip.length - outDuration)) / outDuration, 0, 1)
			: 0;

	if (inIntensity >= outIntensity) {
		return {
			effect: clip.transitions.inPoint.effect,
			intensity: inIntensity,
			source: "in" as const,
		};
	}

	return {
		effect: clip.transitions.outPoint.effect,
		intensity: outIntensity,
		source: "out" as const,
	};
};

const getLayerState = (clips: ClipItem[], currentTime: number): LayerState => {
	const activeClips = clips
		.filter((clip) => currentTime >= clip.start && currentTime <= clip.start + clip.length)
		.sort((a, b) => {
			if (a.track !== b.track) {
				return b.track - a.track;
			}

			if (a.zIndex !== b.zIndex) {
				return a.zIndex - b.zIndex;
			}

			return a.start - b.start;
		});

	return {
		activeClips: activeClips.map((clip) => ({
			clip,
			localTime: clamp(currentTime - clip.start, 0, clip.length),
		})),
	};
};

const drawTextClip = (
	context: CanvasRenderingContext2D,
	sourceCanvas: HTMLCanvasElement,
	clip: ClipItem | undefined,
	localTime: number,
	shouldClear = true
): void => {
	if (shouldClear) {
		context.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
	}
	if (!clip) {
		return;
	}

	const transitionState = getClipTransitionState(clip, localTime);
	let alpha = 1;
	let drawX = clamp(clip.positionX, 0, 1) * sourceCanvas.width;
	let drawY = clamp(clip.positionY, 0, 1) * sourceCanvas.height;
	const anchorXMode = toAnchorXMode(clip.anchorX);
	const anchorYMode = toAnchorYMode(clip.anchorY);
	const hasBaseShadow = clip.shadowEnabled && clip.shadowOpacity > 0;
	const hasGlow = clip.glowEnabled && clip.glowOpacity > 0 && clip.glowStrength > 0;
	let textShadow = hasBaseShadow ? hexToRgba(clip.shadowColor, clip.shadowOpacity) : "rgba(0,0,0,0)";
	let shadowBlur = hasBaseShadow ? clip.shadowBlur : 0;
	let shadowOffsetX = hasBaseShadow ? clip.shadowOffsetX : 0;
	let shadowOffsetY = hasBaseShadow ? clip.shadowOffsetY : 0;
	if (hasGlow) {
		const glowShadowBlur = clip.glowBlur * Math.max(0.1, clip.glowStrength);
		if (!hasBaseShadow || glowShadowBlur >= shadowBlur) {
			textShadow = hexToRgba(clip.glowColor, clip.glowOpacity);
			shadowBlur = glowShadowBlur;
			shadowOffsetX = 0;
			shadowOffsetY = 0;
		}
	}
	let glitchCharacterChaos = false;
	let glitchChaosFrequency = 0;
	let glitchChaosPower = 0;
	let pixelateCellSize = 1;
	let pixelatePower = 0;
	let rgbShiftBaseAngle = 0;
	let rgbShiftMagnitude = 0;
	let rgbShiftColorA = "#ff005a";
	let rgbShiftColorB = "#00e1ff";

	if (transitionState.intensity > 0 && transitionState.effect !== "none") {
		const activePoint = transitionState.source === "in" ? clip.transitions.inPoint : clip.transitions.outPoint;
		const easedIntensity = getEasedTransitionIntensity(
			transitionState.intensity,
			transitionState.source,
			activePoint.easing
		);
			switch (transitionState.effect) {
			case "fade": {
				alpha = 1 - easedIntensity;
				break;
			}
			case "slide": {
				const slideProgress = transitionState.source === "in" ? 1 - easedIntensity : easedIntensity;
				const anchorX = clamp(clip.positionX, 0, 1);
				const anchorY = clamp(clip.positionY, 0, 1);
				drawX =
					(transitionState.source === "in"
						? lerp(activePoint.slideX, anchorX, slideProgress)
						: lerp(anchorX, activePoint.slideX, slideProgress)) * sourceCanvas.width;
				drawY =
					(transitionState.source === "in"
						? lerp(activePoint.slideY, anchorY, slideProgress)
						: lerp(anchorY, activePoint.slideY, slideProgress)) * sourceCanvas.height;
				alpha = 1 - easedIntensity * 0.15;
				break;
			}
			case "pixelate":
				pixelatePower = easedIntensity;
				pixelateCellSize = Math.max(
					1,
					activePoint.pixelateMaxSize * easedIntensity * (0.35 + (1 - activePoint.pixelateResolution) * 1.65)
				);
				context.filter = `blur(${(pixelateCellSize * 0.05).toFixed(2)}px) contrast(${(
					1.05 + easedIntensity * 0.35
				).toFixed(2)})`;
				context.fillStyle = clip.color;
				break;
			case "rgbShift": {
				rgbShiftBaseAngle = activePoint.rgbShiftAngle;
				rgbShiftMagnitude = activePoint.rgbShiftOffset * easedIntensity;
				rgbShiftColorA = activePoint.rgbShiftColorA;
				rgbShiftColorB = activePoint.rgbShiftColorB;
				const angle = (rgbShiftBaseAngle * Math.PI) / 180;
				const offsetX = Math.cos(angle) * rgbShiftMagnitude;
				const offsetY = Math.sin(angle) * rgbShiftMagnitude;
				textShadow = getRgbShiftShadow(offsetX, offsetY, rgbShiftColorA, rgbShiftColorB, 0.78);
				break;
			}
			default:
				break;
		}
	}

	const accentPower = getAccentGlitchIntensityAtTime(clip.accent, localTime);
	if (accentPower > 0) {
		const frequency = 24 * 2 * Math.PI;
		const jitterX = Math.sin(localTime * frequency) * 18 * accentPower;
		const jitterY = Math.cos(localTime * frequency * 0.73) * 12 * accentPower;
		const aberration = 4 + accentPower * 20;
		drawX += jitterX;
		drawY += jitterY;
		textShadow = `${(jitterX + aberration).toFixed(2)}px 0 rgba(255,0,90,0.85), ${(-jitterX - aberration).toFixed(2)}px 0 rgba(0,225,255,0.85), 0 2px 10px rgba(0,0,0,0.6)`;
		shadowBlur = 16 + accentPower * 10;
	}

	context.globalAlpha = alpha * clip.opacity;
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	if (!pixelatePower) {
		context.fillStyle = clip.color;
	}
	const escapedFontFamily = clip.fontFamily.includes(" ") ? `"${clip.fontFamily}"` : clip.fontFamily;
	context.font = `${clip.fontWeight} ${Math.max(12, clip.fontSize)}px ${escapedFontFamily}, sans-serif`;
	context.shadowColor = textShadow;
	context.shadowBlur = shadowBlur;
	context.shadowOffsetX = shadowOffsetX;
	context.shadowOffsetY = shadowOffsetY;
	context.lineJoin = "round";
	context.miterLimit = 2;
	context.strokeStyle = clip.strokeColor;
	context.lineWidth = clip.strokeWidth * 2;
	const letterSpacingPx =
		clip.letterSpacingUnit === "em"
			? clip.letterSpacing * Math.max(12, clip.fontSize)
			: clip.letterSpacing;
	const drawTextWithOutline = (text: string, x: number, y: number): void => {
		if (clip.strokeWidth > 0) {
			context.strokeText(text, x, y);
		}
		context.fillText(text, x, y);
	};
	const drawTextWithLetterSpacing = (text: string, startX: number, baselineY: number): void => {
		if (Math.abs(letterSpacingPx) < 0.001 || text.length <= 1) {
			drawTextWithOutline(text, startX, baselineY);
			return;
		}

		const characters = Array.from(text);
		const widths = characters.map((character) => context.measureText(character).width);
		let cursorX = startX;

		characters.forEach((character, index) => {
			const charWidth = widths[index];
			drawTextWithOutline(character, cursorX, baselineY);
			cursorX += charWidth + letterSpacingPx;
		});
	};
	const transformedText = applyTextTransform(clip.text, clip.textTransform);
	const lines = transformedText.split(/\r?\n/);
	const getLineWidth = (line: string): number => {
		if (line.length === 0) {
			return 0;
		}
		if (Math.abs(letterSpacingPx) < 0.001 || line.length <= 1) {
			return context.measureText(line).width;
		}

		const chars = Array.from(line);
		const widthSum = chars.reduce((total, character) => total + context.measureText(character).width, 0);
		return widthSum + letterSpacingPx * (chars.length - 1);
	};
	const lineWidths = lines.map(getLineWidth);
	const blockWidth = Math.max(...lineWidths, 0);
	const getSharedGlyphMetrics = (): { ascent: number; descent: number } => {
		const compactText = transformedText.replace(/\s+/g, "");
		const sample = compactText.length > 0 ? Array.from(compactText).slice(0, 48).join("") : "Ag";
		const measured = context.measureText(sample);
		const ascent =
			measured.actualBoundingBoxAscent ?? measured.fontBoundingBoxAscent ?? Math.max(12, clip.fontSize) * 0.8;
		const descent =
			measured.actualBoundingBoxDescent ?? measured.fontBoundingBoxDescent ?? Math.max(12, clip.fontSize) * 0.2;
		return {
			ascent: Math.max(0, ascent),
			descent: Math.max(0, descent),
		};
	};
	const sharedGlyphMetrics = getSharedGlyphMetrics();
	const lineGlyphMetrics = lines.map(() => sharedGlyphMetrics);
	const blockLeft =
		anchorXMode === "left" ? drawX - blockWidth : anchorXMode === "right" ? drawX : drawX - blockWidth / 2;
	const getLineStartX = (lineWidth: number): number => {
		if (clip.textAlign === "left") {
			return blockLeft;
		}
		if (clip.textAlign === "right") {
			return blockLeft + (blockWidth - lineWidth);
		}
		return blockLeft + (blockWidth - lineWidth) / 2;
	};
	const lineAdvance = Math.max(12, clip.fontSize) * clip.lineHeight;
	const sharedAscent = sharedGlyphMetrics.ascent;
	const sharedDescent = sharedGlyphMetrics.descent;
	const textBlockHeight = (Math.max(1, lines.length) - 1) * lineAdvance + sharedAscent + sharedDescent;
	const textBlockTopByAnchor =
		anchorYMode === "top"
			? drawY - textBlockHeight
			: anchorYMode === "bottom"
				? drawY
				: drawY - textBlockHeight / 2;
	const firstBaselineY = textBlockTopByAnchor + sharedAscent;
	const lineBaselineYs = lines.map((_, lineIndex) => firstBaselineY + lineIndex * lineAdvance);
	const textBlockTop = lines.reduce((minimum, _line, lineIndex) => {
		const baselineY = lineBaselineYs[lineIndex] ?? drawY;
		const metrics = lineGlyphMetrics[lineIndex] ?? { ascent: Math.max(12, clip.fontSize) * 0.8, descent: Math.max(12, clip.fontSize) * 0.2 };
		return Math.min(minimum, baselineY - metrics.ascent);
	}, Number.POSITIVE_INFINITY);
	const textBlockBottom = lines.reduce((maximum, _line, lineIndex) => {
		const baselineY = lineBaselineYs[lineIndex] ?? drawY;
		const metrics = lineGlyphMetrics[lineIndex] ?? { ascent: Math.max(12, clip.fontSize) * 0.8, descent: Math.max(12, clip.fontSize) * 0.2 };
		return Math.max(maximum, baselineY + metrics.descent);
	}, Number.NEGATIVE_INFINITY);
	if (clip.backgroundEnabled && (clip.backgroundOpacity > 0 || clip.backgroundBorderWidth > 0)) {
		const measuredTextBlockHeight = Math.max(1, textBlockBottom - textBlockTop);
		const backgroundLeft = blockLeft - clip.backgroundPaddingX;
		const backgroundTop = textBlockTop - clip.backgroundPaddingY;
		const backgroundWidth = blockWidth + clip.backgroundPaddingX * 2;
		const backgroundHeight = measuredTextBlockHeight + clip.backgroundPaddingY * 2;
		context.save();
		context.shadowColor = "rgba(0,0,0,0)";
		context.shadowBlur = 0;
		context.shadowOffsetX = 0;
		context.shadowOffsetY = 0;
		if (clip.backgroundOpacity > 0) {
			context.globalAlpha = alpha * clip.backgroundOpacity;
			context.fillStyle = clip.backgroundColor;
			drawRoundedRect(
				context,
				backgroundLeft,
				backgroundTop,
				backgroundWidth,
				backgroundHeight,
				clip.backgroundRadius
			);
			context.fill();
		}
		if (clip.backgroundBorderWidth > 0) {
			context.globalAlpha = alpha;
			context.lineWidth = clip.backgroundBorderWidth;
			context.strokeStyle = clip.backgroundBorderColor;
			drawRoundedRect(
				context,
				backgroundLeft,
				backgroundTop,
				backgroundWidth,
				backgroundHeight,
				clip.backgroundRadius
			);
			context.stroke();
		}
		context.restore();
		context.globalAlpha = alpha * clip.opacity;
		context.shadowColor = textShadow;
		context.shadowBlur = shadowBlur;
		context.shadowOffsetX = shadowOffsetX;
		context.shadowOffsetY = shadowOffsetY;
		context.strokeStyle = clip.strokeColor;
		context.lineWidth = clip.strokeWidth * 2;
	}

	if (glitchCharacterChaos && clip.text.replace(/\r?\n/g, "").length > 1) {
		let characterOffset = 0;
		lines.forEach((line, lineIndex) => {
			const lineY = lineBaselineYs[lineIndex] ?? drawY;
			const characters = Array.from(line);
			if (characters.length === 0) {
				return;
			}

			const widths = characters.map((character) => context.measureText(character).width);
			const totalWidth = widths.reduce((total, width) => total + width, 0) + letterSpacingPx * (characters.length - 1);
			let cursorX = getLineStartX(totalWidth);

			characters.forEach((character, index) => {
				const charWidth = widths[index];
				const phase = localTime * glitchChaosFrequency + (characterOffset + index) * 1.7;
				const charOffsetX = Math.sin(phase * 1.17) * glitchChaosPower * 4;
				const charOffsetY = Math.cos(phase * 0.91) * glitchChaosPower * 4;
				drawTextWithOutline(character, cursorX + charOffsetX, lineY + charOffsetY);
				cursorX += charWidth + letterSpacingPx;
			});

			characterOffset += characters.length;
		});
	} else {
		lines.forEach((line, lineIndex) => {
			const lineWidth = lineWidths[lineIndex] ?? 0;
			const lineStartXBase = getLineStartX(lineWidth);
			const lineStartX = pixelatePower > 0 ? quantizeToStep(lineStartXBase, Math.max(1, pixelateCellSize)) : lineStartXBase;
			const lineYBase = lineBaselineYs[lineIndex] ?? drawY;
			const lineY = pixelatePower > 0 ? quantizeToStep(lineYBase, Math.max(1, pixelateCellSize)) : lineYBase;
			drawTextWithLetterSpacing(line, lineStartX, lineY);
		});
	}
	context.globalAlpha = 1;
	context.shadowBlur = 0;
	context.shadowOffsetX = 0;
	context.shadowOffsetY = 0;
	context.filter = "none";
};

const ShaderPlane = ({
	layerState,
}: {
	layerState: LayerState;
}) => {
	const materialRef = useRef<THREE.ShaderMaterial | null>(null);
	const sourceCanvasARef = useRef<HTMLCanvasElement | null>(null);
	const sourceCanvasBRef = useRef<HTMLCanvasElement | null>(null);
	const sourceTextureARef = useRef<THREE.CanvasTexture | null>(null);
	const sourceTextureBRef = useRef<THREE.CanvasTexture | null>(null);

	const uniforms = useMemo(
		() => ({
			u_textureA: { value: null as THREE.Texture | null },
			u_textureB: { value: null as THREE.Texture | null },
			u_time: { value: 0 },
			u_progress: { value: 0 },
			u_effectType: { value: 0 },
			u_hasOverlay: { value: 0 },
			u_resolution: { value: new THREE.Vector2(1280, 720) },
		}),
		[]
	);

	const vertexShader = useMemo(
		() => `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		[]
	);

	const fragmentShader = useMemo(
		() => `
			uniform sampler2D u_textureA;
			uniform sampler2D u_textureB;
			uniform float u_time;
			uniform float u_progress;
			uniform float u_effectType;
			uniform float u_hasOverlay;
			varying vec2 vUv;

			float random(vec2 p) {
				return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
			}

			vec4 applyFade(vec4 under, vec4 over, float p) {
				return mix(under, over, p);
			}

			vec4 applySlide(vec4 under, vec2 uv, float p) {
				float x = uv.x + (1.0 - p);
				vec2 overUv = vec2(fract(x), uv.y);
				vec4 slidingOver = texture2D(u_textureB, overUv);
				float reveal = step(1.0 - p, uv.x);
				return mix(under, slidingOver, reveal);
			}

			vec4 applyGlitch(vec4 under, vec4 over, vec2 uv, float p) {
				float line = sin(uv.y * 200.0 + u_time * 30.0) * 0.006 * p;
				vec4 shiftedR = texture2D(u_textureB, uv + vec2(line, 0.0));
				vec4 shiftedB = texture2D(u_textureB, uv - vec2(line, 0.0));
				vec4 g = vec4(shiftedR.r, over.g, shiftedB.b, over.a);
				return mix(under, g, p);
			}

			vec4 applyPixelate(vec4 under, vec2 uv, float p) {
				float size = mix(1.0, 36.0, p);
				vec2 grid = floor(uv * size) / size;
				vec4 pix = texture2D(u_textureB, grid);
				return mix(under, pix, p);
			}

			vec4 applyRgbShift(vec4 under, vec2 uv, float p) {
				float s = 0.012 * p;
				float r = texture2D(u_textureB, uv + vec2(s, 0.0)).r;
				float g = texture2D(u_textureB, uv).g;
				float b = texture2D(u_textureB, uv - vec2(s, 0.0)).b;
				vec4 c = vec4(r, g, b, texture2D(u_textureB, uv).a);
				return mix(under, c, p);
			}

			void main() {
				vec2 uv = vUv;
				vec4 under = texture2D(u_textureA, uv);
				if (u_hasOverlay < 0.5) {
					gl_FragColor = under;
					return;
				}

				vec4 over = texture2D(u_textureB, uv);
				vec4 outColor = applyFade(under, over, u_progress);

				if (u_effectType < 1.5) {
					outColor = applyFade(under, over, u_progress);
				} else if (u_effectType < 2.5) {
					outColor = applySlide(under, uv, u_progress);
				} else if (u_effectType < 3.5) {
					outColor = applyGlitch(under, over, uv, u_progress);
				} else if (u_effectType < 4.5) {
					outColor = applyPixelate(under, uv, u_progress);
				} else if (u_effectType < 5.5) {
					outColor = applyRgbShift(under, uv, u_progress);
				}

				gl_FragColor = outColor;
			}
		`,
		[]
	);

	useEffect(() => {
		const createSource = () => {
			const canvas = document.createElement("canvas");
			canvas.width = 1280;
			canvas.height = 720;

			const texture = new THREE.CanvasTexture(canvas);
			texture.minFilter = THREE.LinearFilter;
			texture.magFilter = THREE.LinearFilter;
			texture.needsUpdate = true;
			return { canvas, texture };
		};

		const a = createSource();
		const b = createSource();
		sourceCanvasARef.current = a.canvas;
		sourceCanvasBRef.current = b.canvas;
		sourceTextureARef.current = a.texture;
		sourceTextureBRef.current = b.texture;
		uniforms.u_textureA.value = a.texture;
		uniforms.u_textureB.value = b.texture;

		return () => {
			a.texture.dispose();
			b.texture.dispose();
			sourceCanvasARef.current = null;
			sourceCanvasBRef.current = null;
			sourceTextureARef.current = null;
			sourceTextureBRef.current = null;
		};
	}, [uniforms]);

	useFrame((state) => {
		const sourceCanvasA = sourceCanvasARef.current;
		const sourceCanvasB = sourceCanvasBRef.current;
		const textureA = sourceTextureARef.current;
		const textureB = sourceTextureBRef.current;
		if (!sourceCanvasA || !sourceCanvasB || !textureA || !textureB || !materialRef.current) {
			return;
		}

		const contextA = sourceCanvasA.getContext("2d");
		const contextB = sourceCanvasB.getContext("2d");
		if (!contextA || !contextB) {
			return;
		}

		contextA.fillStyle = "#0b1220";
		contextA.fillRect(0, 0, sourceCanvasA.width, sourceCanvasA.height);
		for (const activeClip of layerState.activeClips) {
			drawTextClip(contextA, sourceCanvasA, activeClip.clip, activeClip.localTime, false);
		}

		contextB.clearRect(0, 0, sourceCanvasB.width, sourceCanvasB.height);

		textureA.needsUpdate = true;
		textureB.needsUpdate = true;
		uniforms.u_time.value = state.clock.elapsedTime;
		uniforms.u_progress.value = 0;
		uniforms.u_effectType.value = effectCodeMap.none;
		uniforms.u_hasOverlay.value = 0;
		uniforms.u_resolution.value.set(sourceCanvasA.width, sourceCanvasA.height);
	});

	return (
		<mesh>
			<planeGeometry args={[16, 9]} />
			<shaderMaterial
				ref={materialRef}
				uniforms={uniforms}
				vertexShader={vertexShader}
				fragmentShader={fragmentShader}
			/>
		</mesh>
	);
};

const ShaderCanvasLayer = ({
	layerState,
}: {
	layerState: LayerState;
}) => {
	return (
		<div className="h-full w-full bg-black">
			<Canvas orthographic camera={{ position: [0, 0, 10], zoom: 70 }} gl={{ antialias: true }}>
				<ShaderPlane layerState={layerState} />
			</Canvas>
		</div>
	);
};

const AssetCard = ({
	asset,
	selected,
	onSelect,
}: {
	asset: TextAsset;
	selected: boolean;
	onSelect: (assetId: string) => void;
}) => {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: `asset:${asset.id}`,
	});

	const style: CSSProperties = {
		transform: CSS.Translate.toString(transform),
		opacity: isDragging ? 0.75 : 1,
		backgroundColor: asset.color,
	};

	return (
		<button
			type="button"
			ref={setNodeRef}
			style={style}
			className={`w-full cursor-grab select-none rounded border px-3 py-2 text-left text-xs text-black active:cursor-grabbing ${selected ? "border-white ring-1 ring-white" : "border-white/10"}`}
			onClick={() => onSelect(asset.id)}
			{...listeners}
			{...attributes}
		>
			<div className="font-semibold">{asset.name}</div>
			<div className="mt-1 truncate opacity-80">{asset.text}</div>
		</button>
	);
};

const TimelineClip = ({
	clip,
	selected,
	onOpenSettings,
	onTrimStart,
}: {
	clip: ClipItem;
	selected: boolean;
	onOpenSettings: (id: string) => void;
	onTrimStart: (clip: ClipItem, edge: TrimEdge, clientX: number) => void;
}) => {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: `clip:${clip.id}`,
	});

	const style: CSSProperties = {
		left: clip.start * PIXELS_PER_SECOND,
		width: Math.max(clip.length * PIXELS_PER_SECOND, 40),
		transform: CSS.Translate.toString(transform),
		zIndex: clip.zIndex + (isDragging ? 100 : 0),
		backgroundColor: clip.color,
	};

	const hasInTransition = clip.transitions.inPoint.effect !== "none" && clip.transitions.inPoint.duration > 0;
	const hasOutTransition = clip.transitions.outPoint.effect !== "none" && clip.transitions.outPoint.duration > 0;

	return (
		<div ref={setNodeRef} style={style} className="absolute top-1 h-10 rounded">
			<div
				className={`relative h-full w-full rounded ${selected ? "ring-2 ring-white" : ""}`}
				onClick={() => onOpenSettings(clip.id)}
			>
				{hasInTransition ? (
					<div className="absolute -top-2 left-0 z-20 rounded bg-amber-500/90 px-1 text-[10px] font-bold text-white">
						IN {clip.transitions.inPoint.effect}
					</div>
				) : null}
				{hasOutTransition ? (
					<div className="absolute -top-2 right-0 z-20 rounded bg-fuchsia-500/90 px-1 text-[10px] font-bold text-white">
						OUT {clip.transitions.outPoint.effect}
					</div>
				) : null}
				<button
					type="button"
					className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l bg-black/35"
					onPointerDown={(event) => {
						event.stopPropagation();
						onTrimStart(clip, "start", event.clientX);
					}}
				/>
				<button
					type="button"
					className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r bg-black/35"
					onPointerDown={(event) => {
						event.stopPropagation();
						onTrimStart(clip, "end", event.clientX);
					}}
				/>
				<button
					type="button"
					className="absolute inset-x-2 inset-y-0 flex items-center justify-between gap-2 overflow-hidden text-left text-[11px] font-semibold text-black"
					onClick={() => onOpenSettings(clip.id)}
					{...listeners}
					{...attributes}
				>
					<span className="truncate">{clip.text}</span>
					<span className="opacity-80">{clip.length.toFixed(2)}s</span>
				</button>
			</div>
		</div>
	);
};

const TimelineTrack = ({
	trackIndex,
	children,
}: {
	trackIndex: number;
	children: ReactNode;
}) => {
	const { isOver, setNodeRef } = useDroppable({
		id: `track:${trackIndex}`,
	});

	return (
		<div
			ref={setNodeRef}
			className={`relative h-12 border-b border-white/10 ${isOver ? "bg-white/10" : "bg-white/5"}`}
		>
			{children}
		</div>
	);
};

export default function EditorPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
	const trimRef = useRef<TrimState | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastFrameTimeRef = useRef<number | null>(null);
	const lastSavedTitleRef = useRef("");
	const lastSavedContentRef = useRef("");
	const [mounted, setMounted] = useState(false);
	const projectIdFromQuery = useMemo(() => {
		const value = searchParams.get("projectId");
		if (!value) {
			return null;
		}
		const id = Number(value);
		return Number.isInteger(id) && id > 0 ? id : null;
	}, [searchParams]);

	const [clips, setClips] = useState<ClipItem[]>(initialClips);
	const [selectedClipId, setSelectedClipId] = useState<string>("");
	const [selectedAssetId, setSelectedAssetId] = useState<string>(textAssets[0].id);
	const [projectId, setProjectId] = useState<number | null>(null);
	const [projectTitle, setProjectTitle] = useState("無題のプロジェクト");
	const [projectError, setProjectError] = useState<string | null>(null);
	const [projectStatus, setProjectStatus] = useState<string | null>(null);
	const [isProjectLoading, setIsProjectLoading] = useState<boolean>(true);
	const [isSavingProject, setIsSavingProject] = useState<boolean>(false);
	const [isExitConfirmOpen, setIsExitConfirmOpen] = useState<boolean>(false);
	const [isExitProcessing, setIsExitProcessing] = useState<boolean>(false);
	const [currentTime, setCurrentTime] = useState<number>(0);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [isExporting, setIsExporting] = useState<boolean>(false);
	const [exportError, setExportError] = useState<string | null>(null);
	const [exportUrl, setExportUrl] = useState<string | null>(null);

	const sensors = useSensors(useSensor(PointerSensor));
	const currentContent = useMemo(
		() =>
			stringifyProjectEditorContent({
				clips,
				selectedClipId,
			}),
		[clips, selectedClipId]
	);
	const normalizedCurrentTitle = useMemo(() => projectTitle.trim(), [projectTitle]);
	const hasUnsavedChanges = useMemo(() => {
		if (!projectId) {
			return false;
		}

		return (
			normalizedCurrentTitle !== lastSavedTitleRef.current ||
			currentContent !== lastSavedContentRef.current
		);
	}, [currentContent, normalizedCurrentTitle, projectId]);

	const syncEditorStateFromStorage = useCallback(() => {
		setClips(readEditorClips<ClipItem>(initialClips).map(normalizeClip));
		setSelectedClipId(readEditorSelectedClipId());
	}, []);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) {
			return;
		}
		syncEditorStateFromStorage();
	}, [mounted, syncEditorStateFromStorage]);

	useEffect(() => {
		if (!mounted) {
			return;
		}

		let cancelled = false;

		const bootstrapProject = async () => {
			setIsProjectLoading(true);
			setProjectError(null);
			setProjectStatus(null);

			try {
				if (projectIdFromQuery) {
					const response = await fetch(`/api/projects/${projectIdFromQuery}`, {
						method: "GET",
						cache: "no-store",
					});
					if (!response.ok) {
						throw new Error("プロジェクトを読み込めませんでした。");
					}
					const data = (await response.json()) as ProjectRecord;
					if (cancelled) {
						return;
					}
					const projectContent = parseProjectEditorContent(data.content);
					setProjectId(data.id);
					setProjectTitle(data.title);
					setClips(projectContent.clips);
					setSelectedClipId(projectContent.selectedClipId);
					lastSavedTitleRef.current = data.title;
					lastSavedContentRef.current = stringifyProjectEditorContent(projectContent);
					writeEditorClips(projectContent.clips.map(normalizeClip));
					writeEditorSelectedClipId(projectContent.selectedClipId);
					return;
				}

				const response = await fetch("/api/projects", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title: "無題のプロジェクト",
						content: stringifyProjectEditorContent(createInitialProjectContent()),
					}),
				});

				if (!response.ok) {
					throw new Error("新規プロジェクトの作成に失敗しました。");
				}

				const data = (await response.json()) as ProjectRecord;
				if (cancelled) {
					return;
				}
				setProjectId(data.id);
				setProjectTitle(data.title);
				setClips([]);
				setSelectedClipId("");
				lastSavedTitleRef.current = data.title;
				lastSavedContentRef.current = stringifyProjectEditorContent(createInitialProjectContent());
				writeEditorClips([]);
				writeEditorSelectedClipId("");
				router.replace(`/editor?projectId=${data.id}`);
				setProjectStatus("新規プロジェクトを作成しました。");
			} catch (error) {
				if (!cancelled) {
					setProjectError(error instanceof Error ? error.message : "プロジェクト処理に失敗しました。");
				}
			} finally {
				if (!cancelled) {
					setIsProjectLoading(false);
				}
			}
		};

		void bootstrapProject();

		return () => {
			cancelled = true;
		};
	}, [mounted, projectIdFromQuery, router]);

	useEffect(() => {
		if (!mounted) {
			return;
		}

		const handleFocus = () => {
			syncEditorStateFromStorage();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				syncEditorStateFromStorage();
			}
		};

		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [mounted, syncEditorStateFromStorage]);

	useEffect(() => {
		if (!mounted) {
			return;
		}
		writeEditorClips(clips.map(normalizeClip));
	}, [clips, mounted]);

	useEffect(() => {
		if (!mounted) {
			return;
		}
		writeEditorSelectedClipId(selectedClipId);
	}, [mounted, selectedClipId]);

	useEffect(() => {
		if (!projectStatus) {
			return;
		}

		const timerId = window.setTimeout(() => {
			setProjectStatus(null);
		}, 2600);

		return () => {
			window.clearTimeout(timerId);
		};
	}, [projectStatus]);

	const duration = useMemo(() => {
		return Math.max(8, ...clips.map((clip) => clip.start + clip.length + 0.5));
	}, [clips]);

	const runtimeLayerState = useMemo(() => getLayerState(clips, currentTime), [clips, currentTime]);

	const deleteClip = useCallback((clipId: string) => {
		setClips((prev) => prev.filter((clip) => clip.id !== clipId));
		setSelectedClipId((prev) => (prev === clipId ? "" : prev));
	}, []);

	const deleteSelectedClip = useCallback(() => {
		if (!selectedClipId) {
			return;
		}
		deleteClip(selectedClipId);
	}, [deleteClip, selectedClipId]);

	useEffect(() => {
		if (!selectedClipId && clips.length > 0) {
			setSelectedClipId(clips[0].id);
		}
	}, [clips, selectedClipId]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const editable =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.tagName === "SELECT" ||
				target?.isContentEditable;

			if (event.code === "Delete" && !editable) {
				event.preventDefault();
				deleteSelectedClip();
				return;
			}

			if (event.code === "Space" && !editable) {
				event.preventDefault();
				setIsPlaying((prev) => {
					if (!prev && currentTime >= duration - 0.01) {
						setCurrentTime(0);
					}
					return !prev;
				});
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [currentTime, deleteSelectedClip, duration]);

	useEffect(() => {
		if (!isPlaying) {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			lastFrameTimeRef.current = null;
			return;
		}

		const loop = (timestamp: number) => {
			if (lastFrameTimeRef.current === null) {
				lastFrameTimeRef.current = timestamp;
			}
			const deltaSec = (timestamp - (lastFrameTimeRef.current ?? timestamp)) / 1000;
			lastFrameTimeRef.current = timestamp;

			setCurrentTime((prev) => {
				const next = prev + deltaSec;
				if (next >= duration) {
					setIsPlaying(false);
					return duration;
				}
				return next;
			});

			rafRef.current = requestAnimationFrame(loop);
		};

		rafRef.current = requestAnimationFrame(loop);
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			lastFrameTimeRef.current = null;
		};
	}, [duration, isPlaying]);

	useEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			const state = trimRef.current;
			if (!state) {
				return;
			}

			const deltaSec = (event.clientX - state.startX) / PIXELS_PER_SECOND;
			setClips((prev) =>
				prev.map((clip) => {
					if (clip.id !== state.clipId) {
						return clip;
					}

					if (state.edge === "start") {
						const nextStart = clamp(
							quantizeQuarter(state.originStart + deltaSec),
							0,
							state.originStart + state.originLength - MIN_CLIP_LENGTH
						);
						const shift = nextStart - state.originStart;
						return {
							...clip,
							start: nextStart,
							length: Math.max(MIN_CLIP_LENGTH, state.originLength - shift),
						};
					}

					return {
						...clip,
						length: clamp(
							quantizeQuarter(state.originLength + deltaSec),
							MIN_CLIP_LENGTH,
							duration - clip.start
						),
					};
				})
			);
		};

		const onPointerUp = () => {
			trimRef.current = null;
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [duration]);

	const openClipSettings = useCallback(
		(clipId: string) => {
			setSelectedClipId(clipId);
			const query = projectId ? `?projectId=${projectId}` : "";
			router.push(`/editor/clip/${clipId}${query}`);
		},
		[projectId, router]
	);

	const handleSaveProject = useCallback(async (): Promise<boolean> => {
		if (!projectId || isSavingProject) {
			return false;
		}

		setIsSavingProject(true);
		setProjectError(null);
		setProjectStatus(null);

		try {
			const response = await fetch(`/api/projects/${projectId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: projectTitle,
					content: stringifyProjectEditorContent({
						clips,
						selectedClipId,
					}),
				}),
			});

			if (!response.ok) {
				throw new Error("保存に失敗しました。");
			}

			lastSavedTitleRef.current = normalizedCurrentTitle;
			lastSavedContentRef.current = currentContent;
			setProjectStatus("保存しました。");
			return true;
		} catch (error) {
			setProjectError(error instanceof Error ? error.message : "保存に失敗しました。");
			return false;
		} finally {
			setIsSavingProject(false);
		}
	}, [currentContent, isSavingProject, normalizedCurrentTitle, projectId, projectTitle]);

	const handleExitWithSave = useCallback(async () => {
		if (isExitProcessing) {
			return;
		}

		setIsExitProcessing(true);
		const saved = await handleSaveProject();
		if (saved) {
			router.push("/dashboard");
		}
		setIsExitProcessing(false);
	}, [handleSaveProject, isExitProcessing, router]);

	const handleExitWithoutSave = useCallback(() => {
		if (isExitProcessing) {
			return;
		}
		router.push("/dashboard");
	}, [isExitProcessing, router]);

	const handleDashboardClick = useCallback(() => {
		if (!hasUnsavedChanges) {
			router.push("/dashboard");
			return;
		}

		setIsExitConfirmOpen(true);
	}, [hasUnsavedChanges, router]);

	const seekTo = (nextTime: number) => {
		setCurrentTime(clamp(nextTime, 0, duration));
	};

	const handleTrimStart = (clip: ClipItem, edge: TrimEdge, clientX: number) => {
		setSelectedClipId(clip.id);
		trimRef.current = {
			clipId: clip.id,
			edge,
			startX: clientX,
			originStart: clip.start,
			originLength: clip.length,
		};
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over, delta } = event;
		if (!over) {
			return;
		}

		const activeId = String(active.id);
		const overId = String(over.id);

		if (activeId.startsWith("asset:") && overId.startsWith("track:")) {
			const assetId = activeId.replace("asset:", "");
			const trackIndex = Number(overId.replace("track:", ""));
			const asset = textAssets.find((item) => item.id === assetId);
			if (!asset) {
				return;
			}

			const canvasRect = timelineCanvasRef.current?.getBoundingClientRect();
			const translatedRect = active.rect.current.translated;
			const initialRect = active.rect.current.initial;
			const dropCenterX = translatedRect
				? translatedRect.left + translatedRect.width / 2
				: initialRect
					? initialRect.left + initialRect.width / 2 + delta.x
					: (canvasRect?.left ?? 0) + currentTime * PIXELS_PER_SECOND;

			const dropStart = canvasRect
				? clamp(quantizeQuarter((dropCenterX - canvasRect.left) / PIXELS_PER_SECOND), 0, duration - MIN_CLIP_LENGTH)
				: quantizeQuarter(currentTime);

			const newClipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
			const maxZ = clips.reduce((max, clip) => Math.max(max, clip.zIndex), 0);
			const nextClip: ClipItem = {
				id: newClipId,
				assetId: asset.id,
				name: asset.name,
				text: asset.text,
				start: dropStart,
				length: 3,
				track: clamp(trackIndex, 0, TRACK_COUNT - 1),
				zIndex: maxZ + 1,
				color: asset.color,
				fontSize: asset.fontSize,
				fontFamily: defaultFontFamily,
				fontWeight: defaultFontWeight,
				textTransform: "none",
				textAlign: "center",
				strokeColor: "#000000",
				strokeWidth: 0,
				letterSpacing: 0,
				letterSpacingUnit: "em",
				lineHeight: 1.2,
				opacity: 1,
				shadowColor: "#000000",
				shadowBlur: 14,
				shadowOffsetX: 0,
				shadowOffsetY: 2,
				shadowOpacity: 0.45,
				shadowEnabled: true,
				glowColor: "#60a5fa",
				glowStrength: 1,
				glowEnabled: false,
				glowBlur: 24,
				glowOpacity: 0.7,
				backgroundColor: "#000000",
				backgroundPaddingX: 16,
				backgroundPaddingY: 8,
				backgroundRadius: 12,
				backgroundEnabled: false,
				backgroundOpacity: 0.55,
				backgroundBorderColor: "#ffffff",
				backgroundBorderWidth: 0,
				positionX: 0.5,
				positionY: 0.5,
				anchorX: "center",
				anchorY: "middle",
				transitions: {
					inPoint: {
						duration: 0,
						effect: "none",
						easing: "linear",
						slideX: 0,
						slideY: 0.5,
						glitchIntensity: 0.65,
						glitchSpeed: 24,
						glitchChromaticAberration: 6,
						glitchCharacterChaos: false,
						pixelateMaxSize: 48,
						pixelateResolution: 0.45,
						rgbShiftAngle: 0,
						rgbShiftOffset: 24,
						rgbShiftColorA: "#ff005a",
						rgbShiftColorB: "#00e1ff",
					},
					outPoint: {
						duration: 0,
						effect: "none",
						easing: "linear",
						slideX: 0,
						slideY: 0.5,
						glitchIntensity: 0.65,
						glitchSpeed: 24,
						glitchChromaticAberration: 6,
						glitchCharacterChaos: false,
						pixelateMaxSize: 48,
						pixelateResolution: 0.45,
						rgbShiftAngle: 0,
						rgbShiftOffset: 24,
						rgbShiftColorA: "#ff005a",
						rgbShiftColorB: "#00e1ff",
					},
				},
				accent: {
					effect: "none",
					triggerTime: 0,
					duration: 0.2,
					intensity: 0.8,
				},
			};

			setClips((prev) => [...prev, nextClip]);
			setSelectedClipId(newClipId);
			return;
		}

		if (activeId.startsWith("clip:") && overId.startsWith("track:")) {
			const clipId = activeId.replace("clip:", "");
			const droppedTrack = Number(overId.replace("track:", ""));

			setClips((prev) =>
				prev.map((clip) => {
					if (clip.id !== clipId) {
						return clip;
					}
					const movedSeconds = delta.x / PIXELS_PER_SECOND;
					return {
						...clip,
						start: clamp(quantizeQuarter(clip.start + movedSeconds), 0, duration - MIN_CLIP_LENGTH),
						track: clamp(droppedTrack, 0, TRACK_COUNT - 1),
					};
				})
			);
		}
	};

	const handleExportVideo = async () => {
		if (clips.length === 0 || isExporting) {
			return;
		}

		setIsExporting(true);
		setExportError(null);
		setExportUrl(null);

		try {
			const response = await fetch("/api/render", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectName: "text-transition-export",
					fps: FPS,
					width: 1280,
					height: 720,
					clips,
				}),
			});
			const data = (await response.json()) as { error?: string; url?: string };
			if (!response.ok || !data.url) {
				throw new Error(data.error ?? "動画の書き出しに失敗しました。");
			}
			setExportUrl(data.url);
		} catch (error) {
			setExportError(error instanceof Error ? error.message : "動画の書き出しに失敗しました。");
		} finally {
			setIsExporting(false);
		}
	};

	if (!mounted || isProjectLoading) {
		return (
			<main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-6 text-white">
				<section className="rounded-lg bg-zinc-900 p-4">
					<h1 className="text-lg font-semibold">Text Transition Editor</h1>
					<p className="mt-1 text-sm text-white/70">プロジェクトを初期化しています...</p>
				</section>
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-6 text-white">
			<section className="rounded-lg bg-zinc-900 p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-lg font-semibold">Text Transition Editor</h1>
						<p className="mt-1 text-sm text-white/70">テキスト専用トランジションシステムで編集します。</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={handleDashboardClick}
							className="rounded border border-white/20 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
						>
							編集修了
						</button>
						<button
							type="button"
							className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
							onClick={() => {
								void handleSaveProject();
							}}
							disabled={!projectId || isSavingProject}
						>
							{isSavingProject ? "保存中..." : "保存"}
						</button>
					</div>
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<label className="text-xs text-white/60" htmlFor="project-title">
						タイトル
					</label>
					<input
						id="project-title"
						type="text"
						value={projectTitle}
						onChange={(event) => setProjectTitle(event.target.value)}
						className="w-full max-w-sm rounded border border-white/20 bg-black/30 px-3 py-1.5 text-sm text-white outline-none ring-blue-500/70 focus:ring"
						placeholder="プロジェクト名"
					/>
					{projectId ? <span className="text-xs text-white/50">ID: {projectId}</span> : null}
				</div>
				{projectStatus ? <p className="mt-2 text-xs text-emerald-300">{projectStatus}</p> : null}
				{projectError ? <p className="mt-2 text-xs text-red-300">{projectError}</p> : null}
			</section>

			<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
				<section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
					<div className="space-y-3 rounded-lg bg-zinc-900 p-4">
						<div className="aspect-video overflow-hidden rounded border border-white/10 bg-black">
							<ShaderCanvasLayer layerState={runtimeLayerState} />
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
								onClick={() => {
									setIsPlaying((prev) => {
										if (!prev && currentTime >= duration - 0.01) {
											setCurrentTime(0);
										}
										return !prev;
									});
								}}
							>
								{isPlaying ? "Pause" : "Play"}
							</button>
							<button
								type="button"
								className="rounded bg-emerald-600/80 px-3 py-1 text-sm hover:bg-emerald-600 disabled:opacity-60"
								onClick={() => {
									void handleExportVideo();
								}}
								disabled={isExporting || clips.length === 0}
							>
								{isExporting ? "Exporting..." : "Export MP4"}
							</button>
							<button
								type="button"
								className="rounded bg-red-500/70 px-3 py-1 text-sm hover:bg-red-500"
								onClick={deleteSelectedClip}
								disabled={!selectedClipId}
							>
								🗑
							</button>
							<input
								type="range"
								className="w-full"
								min={0}
								max={duration}
								step={0.01}
								value={currentTime}
								onChange={(event) => seekTo(Number(event.target.value))}
							/>
							<span className="min-w-24 text-right text-sm tabular-nums text-white/80">
								{currentTime.toFixed(2)} / {duration.toFixed(2)}s
							</span>
						</div>
						{exportError ? <p className="text-xs text-red-300">{exportError}</p> : null}
						{exportUrl ? (
							<p className="text-xs text-emerald-300">
								書き出し完了: {" "}
								<a className="underline" href={exportUrl} target="_blank" rel="noreferrer">
									{exportUrl}
								</a>
							</p>
						) : null}
						<p className="text-xs text-white/60">Space: Play/Pause / Delete: 選択クリップ削除</p>
					</div>

					<div className="space-y-3 rounded-lg bg-zinc-900 p-4">
						<h2 className="text-sm font-semibold text-white/80">Text Assets</h2>
						<div className="space-y-2">
							{textAssets.map((asset) => (
								<AssetCard
									key={asset.id}
									asset={asset}
									selected={asset.id === selectedAssetId}
									onSelect={setSelectedAssetId}
								/>
							))}
						</div>

						<div className="rounded border border-white/10 bg-black/30 p-3">
							<h3 className="text-xs font-semibold text-white/80">Clip Settings</h3>
							<p className="mt-2 text-xs text-white/60">
								タイムライン上のクリップをタップすると、専用の設定ページに遷移します。
							</p>
						</div>
					</div>
				</section>

				<section className="rounded-lg bg-zinc-900 p-4">
					<h2 className="mb-3 text-sm font-semibold text-white/80">Timeline</h2>
					<div className="overflow-x-auto rounded border border-white/10">
						<div
							ref={timelineCanvasRef}
							className="relative min-w-full"
							style={{ width: Math.max(duration * PIXELS_PER_SECOND, 900) }}
						>
							<div className="relative h-8 border-b border-white/10 bg-black/40 text-xs text-white/60">
								{Array.from({ length: Math.ceil(duration) + 1 }).map((_, second) => (
									<div
										key={`tick-${second}`}
										className="absolute top-0 h-full border-l border-white/10 pl-1"
										style={{ left: second * PIXELS_PER_SECOND }}
									>
										{second}s
									</div>
								))}
								<div
									className="absolute top-0 h-full w-0.5 bg-blue-400"
									style={{ left: currentTime * PIXELS_PER_SECOND }}
								/>
							</div>

							{Array.from({ length: TRACK_COUNT }).map((_, trackIndex) => (
								<TimelineTrack key={`track-${trackIndex}`} trackIndex={trackIndex}>
									{clips
										.filter((clip) => clip.track === trackIndex)
										.map((clip) => (
											<TimelineClip
												key={clip.id}
												clip={clip}
												selected={clip.id === selectedClipId}
												onOpenSettings={openClipSettings}
												onTrimStart={handleTrimStart}
											/>
										))}
								</TimelineTrack>
							))}
						</div>
					</div>

					<div className="mt-3 rounded border border-white/10 bg-black/40 p-3">
						<p className="mb-2 text-xs text-white/70">クリップ状態（JSON）</p>
						<pre className="max-h-52 overflow-auto text-xs text-white/90">
							{JSON.stringify(
								clips.map(
									({
										id,
										name,
										text,
										start,
										length,
										track,
										zIndex,
										fontSize,
										fontFamily,
										fontWeight,
										textTransform,
										strokeColor,
										strokeWidth,
										letterSpacing,
										letterSpacingUnit,
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
										positionX,
										positionY,
										anchorX,
										anchorY,
										color,
										transitions,
									}) => ({
										id,
										name,
										text,
										start,
										length,
										track,
										zIndex,
										fontSize,
										fontFamily,
										fontWeight,
										textTransform,
										strokeColor,
										strokeWidth,
										letterSpacing,
										letterSpacingUnit,
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
										positionX,
										positionY,
										anchorX,
										anchorY,
										color,
										transitions,
									})
								),
								null,
								2
							)}
						</pre>
					</div>
				</section>
			</DndContext>

			{isExitConfirmOpen ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
					onClick={() => {
						if (!isExitProcessing && !isSavingProject) {
							setIsExitConfirmOpen(false);
						}
					}}
				>
					<div
						className="w-full max-w-md rounded-xl border border-white/20 bg-zinc-900 p-5"
						onClick={(event) => event.stopPropagation()}
					>
						<h2 className="text-base font-bold text-white">管理画面へ戻りますか？</h2>
						<p className="mt-2 text-sm text-zinc-300">編集中の内容を保存するか選択してください。</p>
						<div className="mt-4 flex flex-col gap-2">
							<button
								type="button"
								onClick={() => {
									void handleExitWithSave();
								}}
								className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
								disabled={isExitProcessing || isSavingProject}
							>
								{isExitProcessing || isSavingProject ? "保存中..." : "保存して終了する"}
							</button>
							<button
								type="button"
								onClick={handleExitWithoutSave}
								className="rounded-md border border-zinc-500 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
								disabled={isExitProcessing || isSavingProject}
							>
								保存せずに終了する
							</button>
							<button
								type="button"
								onClick={() => setIsExitConfirmOpen(false)}
								className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
								disabled={isExitProcessing || isSavingProject}
							>
								編集に戻る
							</button>
						</div>
					</div>
				</div>
			) : null}
		</main>
	);
}
