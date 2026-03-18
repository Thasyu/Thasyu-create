"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
	readEditorClips,
	readEditorProjectId,
	readEditorSelectedClipId,
	writeEditorClips,
	writeEditorProjectId,
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

type ClipItem = {
	id: string;
	assetId: string;
	name: string;
	previewBackgroundColor: string;
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

type FontCategory = {
	label: string;
	fonts: string[];
};

const transitionTypes: TransitionType[] = ["none", "fade", "slide", "pixelate", "rgbShift"];
const transitionEasingTypes: TransitionEasing[] = ["linear", "easeIn", "easeOut", "easeInOut"];
const accentEffects: AccentEffect[] = ["none", "glitch"];
const rgbShiftLegacyChannelMappings: LegacyRgbShiftChannelMapping[] = ["r-gb", "rg-b", "r-g-b"];
const fontCategories: FontCategory[] = [
	{ label: "Sans Serif（標準）", fonts: ["Inter", "Roboto", "Poppins", "Montserrat"] },
	{ label: "Display（タイトル）", fonts: ["Bebas Neue", "Anton", "Oswald"] },
	{ label: "Japanese（日本語）", fonts: ["Noto Sans JP", "M PLUS 1p", "Zen Maru Gothic", "Kosugi"] },
	{ label: "Serif（優雅）", fonts: ["Noto Serif JP", "Playfair Display"] },
	{ label: "Handwriting（手書き）", fonts: ["Pacifico", "Dancing Script"] },
];
const availableFonts = fontCategories.flatMap((category) => category.fonts);
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
const transitionEasingLabels: Record<TransitionEasing, string> = {
	linear: "Linear",
	easeIn: "Ease-In",
	easeOut: "Ease-Out",
	easeInOut: "Ease-In-Out",
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
	return false;
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

const MIN_CLIP_LENGTH = 0.25;

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
	const normalizedPositionX = normalizePositionRatio(clip.positionX);
	const normalizedPositionY = normalizePositionRatio(clip.positionY);
	const normalizedFontFamily = toFontFamily(clip.fontFamily);
	const normalizedLetterSpacingUnit = toLetterSpacingUnit(clip.letterSpacingUnit);
	const normalizedTextTransform = toTextTransformMode(clip.textTransform);
	const normalizedTextAlign = toTextAlignMode(clip.textAlign);
	const normalizedAnchorX = toAnchorXMode(clip.anchorX);
	const normalizedAnchorY = toAnchorYMode(clip.anchorY);
	const rawTransitions = clip.transitions && typeof clip.transitions === "object" ? clip.transitions : ({} as ClipTransitions);
	const rawAccent = clip.accent && typeof clip.accent === "object" ? clip.accent : {};
	return {
		...clip,
		previewBackgroundColor: isHexColor(clip.previewBackgroundColor) ? clip.previewBackgroundColor : "#0b1220",
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

const getTransitionIntensity = (clip: ClipItem, time: number) => {
	const inDuration = clip.transitions.inPoint.duration;
	const outDuration = clip.transitions.outPoint.duration;
	const inIntensity =
		clip.transitions.inPoint.effect !== "none" && inDuration > 0 ? clamp((inDuration - time) / inDuration, 0, 1) : 0;
	const outIntensity =
		clip.transitions.outPoint.effect !== "none" && outDuration > 0
			? clamp((time - (clip.length - outDuration)) / outDuration, 0, 1)
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

const formatTimeSeconds = (value: number): string => `${value.toFixed(3)}s`;
const formatTimeMilliseconds = (value: number): string => `${Math.round(value * 1000)}ms`;
const normalizePositionRatio = (value: number, fallback = 0.5): number => {
	return Number.isFinite(value) ? clamp(value, 0, 1) : fallback;
};
const lerp = (start: number, end: number, progress: number): number => {
	return start + (end - start) * progress;
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

const drawPreviewTextClip = (
	context: CanvasRenderingContext2D,
	sourceCanvas: HTMLCanvasElement,
	clip: ClipItem,
	localTime: number
): void => {
	const transitionState = getTransitionIntensity(clip, localTime);
	let alpha = 1;
	let drawX = normalizePositionRatio(clip.positionX) * sourceCanvas.width;
	let drawY = normalizePositionRatio(clip.positionY) * sourceCanvas.height;
	const anchorXMode = toAnchorXMode(clip.anchorX);
	const anchorYMode = toAnchorYMode(clip.anchorY);
	const hasBaseShadow = clip.shadowEnabled && clip.shadowOpacity > 0;
	const hasGlow = clip.glowEnabled && clip.glowOpacity > 0 && clip.glowStrength > 0;
	let textShadow = hasBaseShadow ? hexColorToRgba(clip.shadowColor, clip.shadowOpacity) : "rgba(0,0,0,0)";
	let shadowBlur = hasBaseShadow ? clip.shadowBlur : 0;
	let shadowOffsetX = hasBaseShadow ? clip.shadowOffsetX : 0;
	let shadowOffsetY = hasBaseShadow ? clip.shadowOffsetY : 0;
	if (hasGlow) {
		const glowShadowBlur = clip.glowBlur * Math.max(0.1, clip.glowStrength);
		if (!hasBaseShadow || glowShadowBlur >= shadowBlur) {
			textShadow = hexColorToRgba(clip.glowColor, clip.glowOpacity);
			shadowBlur = glowShadowBlur;
			shadowOffsetX = 0;
			shadowOffsetY = 0;
		}
	}
	let pixelateCellSize = 1;
	let pixelatePower = 0;

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
				const anchorX = normalizePositionRatio(clip.positionX);
				const anchorY = normalizePositionRatio(clip.positionY);
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
			case "pixelate": {
				pixelatePower = easedIntensity;
				pixelateCellSize = Math.max(
					1,
					activePoint.pixelateMaxSize * easedIntensity * (0.35 + (1 - activePoint.pixelateResolution) * 1.65)
				);
				context.filter = `blur(${(pixelateCellSize * 0.05).toFixed(2)}px) contrast(${(
					1.05 + easedIntensity * 0.35
				).toFixed(2)})`;
				break;
			}
			case "rgbShift": {
				const angle = (activePoint.rgbShiftAngle * Math.PI) / 180;
				const rgbShiftMagnitude = activePoint.rgbShiftOffset * easedIntensity;
				const offsetX = Math.cos(angle) * rgbShiftMagnitude;
				const offsetY = Math.sin(angle) * rgbShiftMagnitude;
				textShadow = getRgbShiftShadow(offsetX, offsetY, activePoint.rgbShiftColorA, activePoint.rgbShiftColorB, 0.78);
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
	context.fillStyle = clip.color;
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
	const compactText = transformedText.replace(/\s+/g, "");
	const metricsSample = compactText.length > 0 ? Array.from(compactText).slice(0, 48).join("") : "Ag";
	const measured = context.measureText(metricsSample);
	const sharedAscent = Math.max(
		0,
		measured.actualBoundingBoxAscent ?? measured.fontBoundingBoxAscent ?? Math.max(12, clip.fontSize) * 0.8
	);
	const sharedDescent = Math.max(
		0,
		measured.actualBoundingBoxDescent ?? measured.fontBoundingBoxDescent ?? Math.max(12, clip.fontSize) * 0.2
	);

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
		return Math.min(minimum, baselineY - sharedAscent);
	}, Number.POSITIVE_INFINITY);
	const textBlockBottom = lines.reduce((maximum, _line, lineIndex) => {
		const baselineY = lineBaselineYs[lineIndex] ?? drawY;
		return Math.max(maximum, baselineY + sharedDescent);
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

	lines.forEach((line, lineIndex) => {
		const lineWidth = lineWidths[lineIndex] ?? 0;
		const lineStartXBase = getLineStartX(lineWidth);
		const lineStartX = pixelatePower > 0 ? quantizeToStep(lineStartXBase, Math.max(1, pixelateCellSize)) : lineStartXBase;
		const lineYBase = lineBaselineYs[lineIndex] ?? drawY;
		const lineY = pixelatePower > 0 ? quantizeToStep(lineYBase, Math.max(1, pixelateCellSize)) : lineYBase;
		drawTextWithLetterSpacing(line, lineStartX, lineY);
	});

	context.globalAlpha = 1;
	context.shadowBlur = 0;
	context.shadowOffsetX = 0;
	context.shadowOffsetY = 0;
	context.filter = "none";
};

const hexColorToRgba = (hexColor: string, opacity: number): string => {
	const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
	if (!match) {
		return `rgba(255,255,255,${opacity})`;
	}
	return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${opacity})`;
};

const getRgbShiftShadow = (
	offsetX: number,
	offsetY: number,
	colorA: string,
	colorB: string,
	alpha = 0.72
): string => {
	const glow = "0 2px 10px rgba(0, 0, 0, 0.55)";
	const dx = offsetX.toFixed(2);
	const dy = offsetY.toFixed(2);
	const ndx = (-offsetX).toFixed(2);
	const ndy = (-offsetY).toFixed(2);
	const primaryColor = colorA;
	const secondaryColor = colorB;
	return `${dx}px ${dy}px ${hexColorToRgba(primaryColor, alpha)}, ${ndx}px ${ndy}px ${hexColorToRgba(secondaryColor, alpha)}, ${glow}`;
};

const normalizeProjectIdValue = (value: string | null | undefined): string => {
	if (!value) {
		return "";
	}

	const normalizedValue = value.trim().replace(/\/+$/, "");
	if (!normalizedValue) {
		return "";
	}

	const id = Number(normalizedValue);
	if (!Number.isInteger(id) || id <= 0) {
		return "";
	}

	return String(id);
};

export default function ClipSettingsClient() {
	const params = useParams<{ clipId: string }>();
	const router = useRouter();
	const searchParams = useSearchParams();
	const clipIdFromParams = params?.clipId;
	const clipIdFromQuery = searchParams.get("clipId") ?? undefined;
	const clipId = clipIdFromParams ?? clipIdFromQuery;
	const [storedProjectId] = useState(() => readEditorProjectId());
	const projectIdFromQuery = normalizeProjectIdValue(searchParams.get("projectId"));
	const effectiveProjectId = projectIdFromQuery || normalizeProjectIdValue(storedProjectId);
	const backToEditorPath = effectiveProjectId ? `/editor?projectId=${encodeURIComponent(effectiveProjectId)}` : "/editor";
	const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

	const [clips, setClips] = useState<ClipItem[]>(() => readEditorClips<ClipItem>([]).map(normalizeClip));
	const [savedSelectedClipId] = useState(() => readEditorSelectedClipId());
	const [previewTime, setPreviewTime] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLooping, setIsLooping] = useState(true);

	useEffect(() => {
		if (effectiveProjectId) {
			writeEditorProjectId(effectiveProjectId);
		}
	}, [effectiveProjectId]);

	useEffect(() => {
		writeEditorClips(clips);
	}, [clips]);

	const activeClipId = useMemo(() => {
		if (!clipId) {
			return "";
		}

		const hasClipByRoute = clips.some((clip) => clip.id === clipId);
		if (hasClipByRoute) {
			return clipId;
		}

		const hasClipBySaved = clips.some((clip) => clip.id === savedSelectedClipId);
		if (hasClipBySaved) {
			return savedSelectedClipId;
		}

		return "";
	}, [clipId, clips, savedSelectedClipId]);

	useEffect(() => {
		if (!activeClipId) {
			return;
		}
		writeEditorSelectedClipId(activeClipId);
	}, [activeClipId]);

	const selectedClip = useMemo(() => {
		if (!activeClipId) {
			return undefined;
		}
		return clips.find((clip) => clip.id === activeClipId);
	}, [activeClipId, clips]);

	const previewTimeWithinClip = useMemo(() => {
		if (!selectedClip) {
			return 0;
		}
		return clamp(previewTime, 0, selectedClip.length);
	}, [previewTime, selectedClip]);

	const updateSelectedClip = useCallback(
		<K extends keyof ClipItem>(key: K, value: ClipItem[K]) => {
			if (!activeClipId) {
				return;
			}
			setClips((prev) => prev.map((clip) => (clip.id === activeClipId ? { ...clip, [key]: value } : clip)));
		},
		[activeClipId]
	);

	const updateSelectedClipTransitions = useCallback(
		<K extends keyof ClipTransitionPoint>(point: keyof ClipTransitions, field: K, value: ClipTransitionPoint[K]) => {
			if (!activeClipId) {
				return;
			}

			setClips((prev) =>
				prev.map((clip) => {
					if (clip.id !== activeClipId) {
						return clip;
					}

					if (field === "duration") {
						const nextTransitions = normalizeTransitionsByLength(
							{
								...clip.transitions,
								[point]: {
									...clip.transitions[point],
									duration: clamp(toFiniteNumber(value, clip.transitions[point].duration), 0, clip.length),
								},
							},
							clip.length
						);

						return {
							...clip,
							transitions: nextTransitions,
						};
					}

					return {
						...clip,
						transitions: {
							...clip.transitions,
							[point]: {
								...clip.transitions[point],
								[field]: value,
							},
						},
					};
				})
			);
		},
		[activeClipId]
	);

	const updateSelectedClipAccent = useCallback(
		<K extends keyof ClipAccent>(field: K, value: ClipAccent[K]) => {
			if (!activeClipId) {
				return;
			}

			setClips((prev) =>
				prev.map((clip) => {
					if (clip.id !== activeClipId) {
						return clip;
					}

					return {
						...clip,
						accent: normalizeAccentByLength(
							{
								...clip.accent,
								[field]: value,
							},
							clip.length
						),
					};
				})
			);
		},
		[activeClipId]
	);

	const updateSelectedClipLength = useCallback(
		(value: number) => {
			if (!activeClipId) {
				return;
			}

			setClips((prev) =>
				prev.map((clip) => {
					if (clip.id !== activeClipId) {
						return clip;
					}

					const normalizedLength = Math.max(Number.isFinite(value) ? value : clip.length, MIN_CLIP_LENGTH);
					return {
						...clip,
						length: normalizedLength,
						transitions: normalizeTransitionsByLength(clip.transitions, normalizedLength),
						accent: normalizeAccentByLength(clip.accent, normalizedLength),
					};
				})
			);
		},
		[activeClipId]
	);

	const handleFontFamilyChange = useCallback(
		(nextFontFamilyRaw: string) => {
			if (!activeClipId) {
				return;
			}

			const nextFontFamily = toFontFamily(nextFontFamilyRaw);
			setClips((prev) =>
				prev.map((clip) => {
					if (clip.id !== activeClipId) {
						return clip;
					}

					return {
						...clip,
						fontFamily: nextFontFamily,
						fontWeight: toFontWeight(clip.fontWeight, nextFontFamily),
					};
				})
			);
		},
		[activeClipId]
	);

	useEffect(() => {
		if (!selectedClip || !isPlaying) {
			return;
		}

		const clipLength = Math.max(selectedClip.length, 0);
		let animationFrameId = 0;
		let previousTimestamp = performance.now();

		const tick = (timestamp: number) => {
			const deltaTime = (timestamp - previousTimestamp) / 1000;
			previousTimestamp = timestamp;
			let shouldContinue = true;

			setPreviewTime((prev) => {
				const base = clamp(prev, 0, clipLength);
				const next = base + deltaTime;
				if (isLooping && clipLength > 0) {
					return next % clipLength;
				}
				if (next >= clipLength) {
					shouldContinue = false;
					return clipLength;
				}
				return next;
			});

			if (!shouldContinue) {
				setIsPlaying(false);
				return;
			}

			animationFrameId = requestAnimationFrame(tick);
		};

		animationFrameId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animationFrameId);
	}, [selectedClip, isPlaying, isLooping]);

	useEffect(() => {
		const canvas = previewCanvasRef.current;
		if (!canvas) {
			return;
		}

		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}

		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = selectedClip?.previewBackgroundColor ?? "#0b1220";
		context.fillRect(0, 0, canvas.width, canvas.height);

		if (!selectedClip) {
			return;
		}

		drawPreviewTextClip(context, canvas, selectedClip, previewTimeWithinClip);
	}, [selectedClip, previewTimeWithinClip]);

	const selectedClipSupportedFontWeights = selectedClip ? getSupportedFontWeights(selectedClip.fontFamily) : fontWeightOptions;
	const isSelectedFontWeightLocked = selectedClipSupportedFontWeights.length <= 1;

	return (
		<main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 text-white">
			<section className="rounded-lg bg-zinc-900 p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h1 className="text-lg font-semibold">Clip Settings</h1>
						<p className="mt-1 text-xs text-white/70">クリップ専用の設定ページです。</p>
					</div>
					<button
						type="button"
						className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
						onClick={() => router.push(backToEditorPath)}
					>
						← Editorへ戻る
					</button>
				</div>
			</section>

			{selectedClip ? (
				<>
					<section className="rounded border border-white/10 bg-zinc-900 p-4">
						<h2 className="text-sm font-semibold text-white/80">Playback Settings</h2>
						<div className="mt-3 space-y-2 text-xs">
							<label className="space-y-1">
								<span className="text-white/60">表示時間 (Duration / 秒)</span>
								<input
									type="number"
									step={0.25}
									min={MIN_CLIP_LENGTH}
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.length}
									onChange={(event) => updateSelectedClipLength(Number(event.target.value))}
								/>
							</label>
							<p className="text-white/60">
								クリップの長さです。イン点/アウト点の遷移時間は合計がクリップ長に収まるよう自動調整されます。
							</p>
						</div>
					</section>

					<section className="rounded border border-white/10 bg-zinc-900 p-4">
						<div className="flex items-center justify-between gap-2">
							<h2 className="text-sm font-semibold text-white/80">Clip Preview</h2>
							<p className="text-xs text-white/60">{selectedClip.name}</p>
						</div>
						<div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
							<button
								type="button"
								className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
								onClick={() => setIsPlaying((prev) => !prev)}
							>
								{isPlaying ? "一時停止" : "再生"}
							</button>
							<button
								type="button"
								className={`rounded px-3 py-1 ${isLooping ? "bg-sky-500/30 text-sky-100" : "bg-white/10 hover:bg-white/20"}`}
								onClick={() => setIsLooping((prev) => !prev)}
							>
								ループ {isLooping ? "ON" : "OFF"}
							</button>
							<p className="ml-auto text-white/70">
								現在 {formatTimeSeconds(previewTimeWithinClip)} / 全体 {formatTimeSeconds(selectedClip.length)}
								（{formatTimeMilliseconds(previewTimeWithinClip)} / {formatTimeMilliseconds(selectedClip.length)}）
							</p>
						</div>
						<div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_9rem]">
							<label className="space-y-1">
								<span className="text-white/60">プレビュー背景色</span>
								<input
									type="color"
									className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
									value={selectedClip.previewBackgroundColor}
									onChange={(event) => updateSelectedClip("previewBackgroundColor", event.target.value)}
								/>
							</label>
							<label className="space-y-1">
								<span className="text-white/60">HEX</span>
								<input
									type="text"
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.previewBackgroundColor}
									onChange={(event) => {
										const nextValue = event.target.value.trim();
										if (isHexColor(nextValue)) {
											updateSelectedClip("previewBackgroundColor", nextValue);
										}
									}}
									placeholder="#0b1220"
								/>
							</label>
						</div>
						<div className="mt-2">
							<input
								type="range"
								min={0}
								max={selectedClip.length}
								step={0.001}
								value={previewTimeWithinClip}
								className="w-full accent-sky-400"
								onChange={(event) => setPreviewTime(clamp(Number(event.target.value), 0, selectedClip.length))}
							/>
						</div>
						<div className="mt-3 overflow-hidden rounded border border-white/10 bg-black">
							<div
								className="relative aspect-video w-full"
								style={{ backgroundColor: selectedClip.previewBackgroundColor }}
							>
								<canvas ref={previewCanvasRef} width={1280} height={720} className="pointer-events-none h-full w-full" />
							</div>
						</div>
						<p className="mt-2 text-xs text-white/60">
							位置: X {normalizePositionRatio(selectedClip.positionX).toFixed(2)} / Y {normalizePositionRatio(selectedClip.positionY).toFixed(2)}
						</p>
					</section>

					<section className="rounded border border-white/10 bg-zinc-900 p-4">
						<h2 className="text-sm font-semibold text-white/80">Text Settings</h2>
						<div className="mt-3 space-y-2 text-xs">
							<label className="space-y-1">
								<span className="text-white/60">テキスト</span>
								<textarea
									className="h-24 w-full resize-y rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.text}
									onChange={(event) => updateSelectedClip("text", event.target.value)}
								/>
								<p className="text-[11px] text-white/50">Enterキーで改行できます。</p>
							</label>
							<label className="space-y-1">
								<span className="text-white/60">フォント</span>
								<select
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.fontFamily}
									onChange={(event) => handleFontFamilyChange(event.target.value)}
								>
									{fontCategories.map((category) => (
										<optgroup key={category.label} label={category.label}>
											{category.fonts.map((fontName) => (
												<option key={fontName} value={fontName} className="bg-zinc-700 text-white">
													{fontName}
												</option>
											))}
										</optgroup>
									))}
								</select>
							</label>
							<label className="space-y-1">
								<span className="text-white/60">テキスト変換</span>
								<select
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.textTransform}
									onChange={(event) => updateSelectedClip("textTransform", toTextTransformMode(event.target.value))}
								>
									<option value="none" className="bg-zinc-700 text-white">None（入力どおり）</option>
									<option value="uppercase" className="bg-zinc-700 text-white">Uppercase（すべて大文字）</option>
									<option value="lowercase" className="bg-zinc-700 text-white">Lowercase（すべて小文字）</option>
								</select>
							</label>
							<label className="space-y-1">
								<span className="text-white/60">テキスト揃え</span>
								<select
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.textAlign}
									onChange={(event) => updateSelectedClip("textAlign", toTextAlignMode(event.target.value))}
								>
									<option value="left" className="bg-zinc-700 text-white">Left（左揃え）</option>
									<option value="center" className="bg-zinc-700 text-white">Center（中央揃え）</option>
									<option value="right" className="bg-zinc-700 text-white">Right（右揃え）</option>
								</select>
							</label>
							<label className="space-y-1">
								<div className="flex items-center justify-between gap-2">
									<span className="text-white/60">フォント太さ</span>
									{isSelectedFontWeightLocked ? (
										<span className="rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
											このフォントは太さ固定
										</span>
									) : null}
								</div>
								<select
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.fontWeight}
									onChange={(event) =>
										updateSelectedClip("fontWeight", toFontWeight(Number(event.target.value), selectedClip.fontFamily))
									}
								>
									{selectedClipSupportedFontWeights.map((weight) => (
										<option key={weight} value={weight} className="bg-zinc-700 text-white">
											{weight === 300
												? "Light (300)"
												: weight === 400
													? "Regular (400)"
													: weight === 500
														? "Medium (500)"
														: weight === 700
															? "Bold (700)"
															: "Black (900)"}
										</option>
									))}
								</select>
								{isSelectedFontWeightLocked ? (
									<p className="text-[11px] text-white/50">選択中フォントは単一ウェイトのみ対応しています。</p>
								) : null}
							</label>
							<div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end">
								<label className="space-y-1">
									<span className="text-white/60">文字間隔</span>
									<input
										type="number"
										step={selectedClip.letterSpacingUnit === "em" ? 0.01 : 1}
										min={selectedClip.letterSpacingUnit === "em" ? -0.1 : -10}
										max={selectedClip.letterSpacingUnit === "em" ? 1 : 160}
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.letterSpacing}
										onChange={(event) =>
											updateSelectedClip(
												"letterSpacing",
												toLetterSpacing(Number(event.target.value), selectedClip.letterSpacingUnit)
											)
										}
									/>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">単位</span>
									<select
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.letterSpacingUnit}
										onChange={(event) => {
											const nextUnit = toLetterSpacingUnit(event.target.value);
											updateSelectedClip("letterSpacingUnit", nextUnit);
											updateSelectedClip("letterSpacing", toLetterSpacing(selectedClip.letterSpacing, nextUnit));
										}}
									>
										<option value="em" className="bg-zinc-700 text-white">em</option>
										<option value="px" className="bg-zinc-700 text-white">px</option>
									</select>
								</label>
							</div>
							<p className="text-[11px] text-white/50">推奨範囲: -0.1em 〜 1.0em（pxでも調整可能）</p>
							<label className="space-y-1">
								<span className="text-white/60">行間（Line Height）</span>
								<input
									type="number"
									step={0.05}
									min={0}
									max={2}
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.lineHeight}
									onChange={(event) => updateSelectedClip("lineHeight", toLineHeight(Number(event.target.value)))}
								/>
								<p className="text-[11px] text-white/50">推奨範囲: 0.0 〜 2.0（倍率）</p>
							</label>
							<label className="space-y-1">
								<span className="text-white/60">透明度（Opacity）</span>
								<input
									type="number"
									step={0.01}
									min={0}
									max={1}
									className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
									value={selectedClip.opacity}
									onChange={(event) => updateSelectedClip("opacity", toOpacity(Number(event.target.value)))}
								/>
								<p className="text-[11px] text-white/50">0: 完全透明 / 0.5: 半透明 / 1: 完全不透明</p>
							</label>
							<div className="rounded border border-white/10 bg-zinc-950/40 p-3">
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={selectedClip.shadowEnabled}
										onChange={(event) => updateSelectedClip("shadowEnabled", event.target.checked)}
									/>
									<span className="text-white/70">影を有効にする（shadowEnabled）</span>
								</label>
								<div className="mt-3 grid grid-cols-2 gap-2">
									<label className="space-y-1">
										<span className="text-white/60">影の色（shadowColor）</span>
										<input
											type="color"
											className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
											value={selectedClip.shadowColor}
											onChange={(event) => updateSelectedClip("shadowColor", event.target.value)}
											disabled={!selectedClip.shadowEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">影の透明度（shadowOpacity）</span>
										<input
											type="number"
											step={0.01}
											min={0}
											max={1}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.shadowOpacity}
											onChange={(event) => updateSelectedClip("shadowOpacity", toShadowOpacity(Number(event.target.value)))}
											disabled={!selectedClip.shadowEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">影のぼかし（shadowBlur）</span>
										<input
											type="number"
											step={0.5}
											min={0}
											max={100}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.shadowBlur}
											onChange={(event) => updateSelectedClip("shadowBlur", toShadowBlur(Number(event.target.value)))}
											disabled={!selectedClip.shadowEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">影Xずれ（shadowOffsetX）</span>
										<input
											type="number"
											step={0.5}
											min={-200}
											max={200}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.shadowOffsetX}
											onChange={(event) => updateSelectedClip("shadowOffsetX", toShadowOffset(Number(event.target.value)))}
											disabled={!selectedClip.shadowEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">影Yずれ（shadowOffsetY）</span>
										<input
											type="number"
											step={0.5}
											min={-200}
											max={200}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.shadowOffsetY}
											onChange={(event) => updateSelectedClip("shadowOffsetY", toShadowOffset(Number(event.target.value)))}
											disabled={!selectedClip.shadowEnabled}
										/>
									</label>
								</div>
							</div>
							<div className="rounded border border-white/10 bg-zinc-950/40 p-3">
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={selectedClip.glowEnabled}
										onChange={(event) => updateSelectedClip("glowEnabled", event.target.checked)}
									/>
									<span className="text-white/70">グローを有効にする（glowEnabled）</span>
								</label>
								<div className="mt-3 grid grid-cols-2 gap-2">
									<label className="space-y-1">
										<span className="text-white/60">グロー色（glowColor）</span>
										<input
											type="color"
											className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
											value={selectedClip.glowColor}
											onChange={(event) => updateSelectedClip("glowColor", event.target.value)}
											disabled={!selectedClip.glowEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">グロー強さ（glowStrength）</span>
										<input
											type="number"
											step={0.1}
											min={0}
											max={5}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.glowStrength}
											onChange={(event) => updateSelectedClip("glowStrength", toGlowStrength(Number(event.target.value)))}
											disabled={!selectedClip.glowEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">グローぼかし（glowBlur）</span>
										<input
											type="number"
											step={0.5}
											min={0}
											max={120}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.glowBlur}
											onChange={(event) => updateSelectedClip("glowBlur", toGlowBlur(Number(event.target.value)))}
											disabled={!selectedClip.glowEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">グロー透明度（glowOpacity）</span>
										<input
											type="number"
											step={0.01}
											min={0}
											max={1}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.glowOpacity}
											onChange={(event) => updateSelectedClip("glowOpacity", toGlowOpacity(Number(event.target.value)))}
											disabled={!selectedClip.glowEnabled}
										/>
									</label>
								</div>
							</div>
							<div className="rounded border border-white/10 bg-zinc-950/40 p-3">
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={selectedClip.backgroundEnabled}
										onChange={(event) => updateSelectedClip("backgroundEnabled", event.target.checked)}
									/>
									<span className="text-white/70">背景ボックスを有効にする（backgroundEnabled）</span>
								</label>
								<div className="mt-3 grid grid-cols-2 gap-2">
									<label className="space-y-1">
										<span className="text-white/60">背景色（backgroundColor）</span>
										<input
											type="color"
											className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
											value={selectedClip.backgroundColor}
											onChange={(event) => updateSelectedClip("backgroundColor", event.target.value)}
											disabled={!selectedClip.backgroundEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">背景透明度（backgroundOpacity）</span>
										<input
											type="number"
											step={0.01}
											min={0}
											max={1}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.backgroundOpacity}
											onChange={(event) => updateSelectedClip("backgroundOpacity", toBackgroundOpacity(Number(event.target.value)))}
											disabled={!selectedClip.backgroundEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">左右余白（backgroundPaddingX）</span>
										<input
											type="number"
											step={0.5}
											min={0}
											max={200}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.backgroundPaddingX}
											onChange={(event) => updateSelectedClip("backgroundPaddingX", toBackgroundPaddingX(Number(event.target.value)))}
											disabled={!selectedClip.backgroundEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">上下余白（backgroundPaddingY）</span>
										<input
											type="number"
											step={0.5}
											min={0}
											max={200}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.backgroundPaddingY}
											onChange={(event) => updateSelectedClip("backgroundPaddingY", toBackgroundPaddingY(Number(event.target.value)))}
											disabled={!selectedClip.backgroundEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">角丸（backgroundRadius）</span>
										<input
											type="number"
											step={0.5}
											min={0}
											max={200}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.backgroundRadius}
											onChange={(event) => updateSelectedClip("backgroundRadius", toBackgroundRadius(Number(event.target.value)))}
											disabled={!selectedClip.backgroundEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">枠線色（backgroundBorderColor）</span>
										<input
											type="color"
											className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
											value={selectedClip.backgroundBorderColor}
											onChange={(event) => updateSelectedClip("backgroundBorderColor", event.target.value)}
											disabled={!selectedClip.backgroundEnabled}
										/>
									</label>
									<label className="space-y-1">
										<span className="text-white/60">枠線太さ（backgroundBorderWidth）</span>
										<input
											type="number"
											step={0.5}
											min={0}
											max={20}
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.backgroundBorderWidth}
											onChange={(event) => updateSelectedClip("backgroundBorderWidth", toBackgroundBorderWidth(Number(event.target.value)))}
											disabled={!selectedClip.backgroundEnabled}
										/>
									</label>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<label className="space-y-1">
									<span className="text-white/60">フォントサイズ</span>
									<input
										type="number"
										min={12}
										max={200}
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.fontSize}
										onChange={(event) => updateSelectedClip("fontSize", Number(event.target.value))}
									/>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">フォント色</span>
									<input
										type="color"
										className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
										value={selectedClip.color}
										onChange={(event) => updateSelectedClip("color", event.target.value)}
									/>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">縁の色（Outline）</span>
									<input
										type="color"
										className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
										value={selectedClip.strokeColor}
										onChange={(event) => updateSelectedClip("strokeColor", event.target.value)}
									/>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">縁の太さ（px）</span>
									<input
										type="number"
										step={0.1}
										min={0}
										max={5}
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.strokeWidth}
										onChange={(event) => updateSelectedClip("strokeWidth", toStrokeWidth(Number(event.target.value)))}
									/>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">X位置 (0-1)</span>
									<input
										type="number"
										step={0.01}
										min={0}
										max={1}
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.positionX}
										onChange={(event) =>
											updateSelectedClip("positionX", clamp(Number(event.target.value), 0, 1))
										}
									/>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">Y位置 (0-1)</span>
									<input
										type="number"
										step={0.01}
										min={0}
										max={1}
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.positionY}
										onChange={(event) =>
											updateSelectedClip("positionY", clamp(Number(event.target.value), 0, 1))
										}
									/>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">Anchor X</span>
									<select
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.anchorX}
										onChange={(event) => updateSelectedClip("anchorX", toAnchorXMode(event.target.value))}
									>
										<option value="left" className="bg-zinc-700 text-white">left</option>
										<option value="center" className="bg-zinc-700 text-white">center</option>
										<option value="right" className="bg-zinc-700 text-white">right</option>
									</select>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">Anchor Y</span>
									<select
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.anchorY}
										onChange={(event) => updateSelectedClip("anchorY", toAnchorYMode(event.target.value))}
									>
										<option value="top" className="bg-zinc-700 text-white">top</option>
										<option value="middle" className="bg-zinc-700 text-white">middle</option>
										<option value="bottom" className="bg-zinc-700 text-white">bottom</option>
									</select>
								</label>
							</div>
						</div>
					</section>

					<section className="rounded border border-white/10 bg-zinc-900 p-4">
						<h2 className="text-sm font-semibold text-white/80">Effect Settings</h2>
						<div className="mt-3 space-y-2 text-xs">
							<div className="grid grid-cols-2 gap-2">
								<label className="space-y-1">
									<span className="text-white/60">イン点 効果</span>
									<select
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.transitions.inPoint.effect}
										onChange={(event) =>
											updateSelectedClipTransitions("inPoint", "effect", event.target.value as TransitionType)
										}
									>
										{transitionTypes.map((type) => (
											<option key={`in-${type}`} value={type} className="bg-zinc-700 text-white">
												{type}
											</option>
										))}
									</select>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">イン点 遷移時間</span>
									<input
										type="number"
										step={0.25}
										min={0}
										max={selectedClip.length}
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.transitions.inPoint.duration}
										onChange={(event) =>
											updateSelectedClipTransitions("inPoint", "duration", Number(event.target.value))
										}
									/>
								</label>
								{selectedClip.transitions.inPoint.effect !== "none" ? (
									<label className="space-y-1">
										<span className="text-white/60">イン点 Easing</span>
										<select
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.transitions.inPoint.easing}
											onChange={(event) =>
												updateSelectedClipTransitions("inPoint", "easing", event.target.value as TransitionEasing)
											}
										>
											{transitionEasingTypes.map((easing) => (
												<option key={`in-easing-${easing}`} value={easing} className="bg-zinc-700 text-white">
													{transitionEasingLabels[easing]}
												</option>
											))}
										</select>
									</label>
								) : null}
								{selectedClip.transitions.inPoint.effect === "slide" ? (
									<>
										<label className="space-y-1">
											<span className="text-white/60">イン点 X (0-1)</span>
											<input
												type="number"
												step={0.01}
												min={0}
												max={1}
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.transitions.inPoint.slideX}
												onChange={(event) => updateSelectedClipTransitions("inPoint", "slideX", clampRatio(Number(event.target.value)))}
											/>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">イン点 Y (0-1)</span>
											<input
												type="number"
												step={0.01}
												min={0}
												max={1}
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.transitions.inPoint.slideY}
												onChange={(event) => updateSelectedClipTransitions("inPoint", "slideY", clampRatio(Number(event.target.value)))}
											/>
										</label>
									</>
								) : null}
								{selectedClip.transitions.inPoint.effect === "pixelate" ? (
									<>
										<label className="space-y-1">
											<span className="text-white/60">イン点 ドットサイズ (1-100)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={1}
													min={1}
													max={100}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.inPoint.pixelateMaxSize}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "pixelateMaxSize", clampPixelateMaxSize(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={1}
													min={1}
													max={100}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.inPoint.pixelateMaxSize}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "pixelateMaxSize", clampPixelateMaxSize(Number(event.target.value)))}
												/>
											</div>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">イン点 Sampling Density (0-1)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={0.01}
													min={0}
													max={1}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.inPoint.pixelateResolution}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "pixelateResolution", clampPixelateResolution(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={0.01}
													min={0}
													max={1}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.inPoint.pixelateResolution}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "pixelateResolution", clampPixelateResolution(Number(event.target.value)))}
												/>
											</div>
										</label>
									</>
								) : null}
								{selectedClip.transitions.inPoint.effect === "rgbShift" ? (
									<>
										<label className="space-y-1">
											<span className="text-white/60">イン点 ズレ角度 (0-360°)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={1}
													min={0}
													max={360}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.inPoint.rgbShiftAngle}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "rgbShiftAngle", clampRgbShiftAngle(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={1}
													min={0}
													max={360}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.inPoint.rgbShiftAngle}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "rgbShiftAngle", clampRgbShiftAngle(Number(event.target.value)))}
												/>
											</div>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">イン点 ズレ量 (0-50px)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={0.5}
													min={0}
													max={50}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.inPoint.rgbShiftOffset}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "rgbShiftOffset", clampRgbShiftOffset(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={0.5}
													min={0}
													max={50}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.inPoint.rgbShiftOffset}
													onChange={(event) => updateSelectedClipTransitions("inPoint", "rgbShiftOffset", clampRgbShiftOffset(Number(event.target.value)))}
												/>
											</div>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">イン点 Color A (Start Color)</span>
											<input
												type="color"
												className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
												value={selectedClip.transitions.inPoint.rgbShiftColorA}
												onChange={(event) => updateSelectedClipTransitions("inPoint", "rgbShiftColorA", event.target.value)}
											/>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">イン点 Color B (End Color)</span>
											<input
												type="color"
												className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
												value={selectedClip.transitions.inPoint.rgbShiftColorB}
												onChange={(event) => updateSelectedClipTransitions("inPoint", "rgbShiftColorB", event.target.value)}
											/>
										</label>
									</>
								) : null}
								<label className="space-y-1">
									<span className="text-white/60">アウト点 効果</span>
									<select
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.transitions.outPoint.effect}
										onChange={(event) =>
											updateSelectedClipTransitions("outPoint", "effect", event.target.value as TransitionType)
										}
									>
										{transitionTypes.map((type) => (
											<option key={`out-${type}`} value={type} className="bg-zinc-700 text-white">
												{type}
											</option>
										))}
									</select>
								</label>
								<label className="space-y-1">
									<span className="text-white/60">アウト点 遷移時間</span>
									<input
										type="number"
										step={0.25}
										min={0}
										max={selectedClip.length}
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.transitions.outPoint.duration}
										onChange={(event) =>
											updateSelectedClipTransitions("outPoint", "duration", Number(event.target.value))
										}
									/>
								</label>
								{selectedClip.transitions.outPoint.effect !== "none" ? (
									<label className="space-y-1">
										<span className="text-white/60">アウト点 Easing</span>
										<select
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.transitions.outPoint.easing}
											onChange={(event) =>
												updateSelectedClipTransitions("outPoint", "easing", event.target.value as TransitionEasing)
											}
										>
											{transitionEasingTypes.map((easing) => (
												<option key={`out-easing-${easing}`} value={easing} className="bg-zinc-700 text-white">
													{transitionEasingLabels[easing]}
												</option>
											))}
										</select>
									</label>
								) : null}
								{selectedClip.transitions.outPoint.effect === "slide" ? (
									<>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 X (0-1)</span>
											<input
												type="number"
												step={0.01}
												min={0}
												max={1}
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.transitions.outPoint.slideX}
												onChange={(event) => updateSelectedClipTransitions("outPoint", "slideX", clampRatio(Number(event.target.value)))}
											/>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 Y (0-1)</span>
											<input
												type="number"
												step={0.01}
												min={0}
												max={1}
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.transitions.outPoint.slideY}
												onChange={(event) => updateSelectedClipTransitions("outPoint", "slideY", clampRatio(Number(event.target.value)))}
											/>
										</label>
									</>
								) : null}
								{selectedClip.transitions.outPoint.effect === "pixelate" ? (
									<>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 ドットサイズ (1-100)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={1}
													min={1}
													max={100}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.outPoint.pixelateMaxSize}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "pixelateMaxSize", clampPixelateMaxSize(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={1}
													min={1}
													max={100}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.outPoint.pixelateMaxSize}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "pixelateMaxSize", clampPixelateMaxSize(Number(event.target.value)))}
												/>
											</div>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 Sampling Density (0-1)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={0.01}
													min={0}
													max={1}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.outPoint.pixelateResolution}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "pixelateResolution", clampPixelateResolution(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={0.01}
													min={0}
													max={1}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.outPoint.pixelateResolution}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "pixelateResolution", clampPixelateResolution(Number(event.target.value)))}
												/>
											</div>
										</label>
									</>
								) : null}
								{selectedClip.transitions.outPoint.effect === "rgbShift" ? (
									<>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 ズレ角度 (0-360°)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={1}
													min={0}
													max={360}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.outPoint.rgbShiftAngle}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "rgbShiftAngle", clampRgbShiftAngle(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={1}
													min={0}
													max={360}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.outPoint.rgbShiftAngle}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "rgbShiftAngle", clampRgbShiftAngle(Number(event.target.value)))}
												/>
											</div>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 ズレ量 (0-50px)</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={0.5}
													min={0}
													max={50}
													className="w-full accent-sky-400"
													value={selectedClip.transitions.outPoint.rgbShiftOffset}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "rgbShiftOffset", clampRgbShiftOffset(Number(event.target.value)))}
												/>
												<input
													type="number"
													step={0.5}
													min={0}
													max={50}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.transitions.outPoint.rgbShiftOffset}
													onChange={(event) => updateSelectedClipTransitions("outPoint", "rgbShiftOffset", clampRgbShiftOffset(Number(event.target.value)))}
												/>
											</div>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 Color A (Start Color)</span>
											<input
												type="color"
												className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
												value={selectedClip.transitions.outPoint.rgbShiftColorA}
												onChange={(event) => updateSelectedClipTransitions("outPoint", "rgbShiftColorA", event.target.value)}
											/>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">アウト点 Color B (End Color)</span>
											<input
												type="color"
												className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
												value={selectedClip.transitions.outPoint.rgbShiftColorB}
												onChange={(event) => updateSelectedClipTransitions("outPoint", "rgbShiftColorB", event.target.value)}
											/>
										</label>
									</>
								) : null}
							</div>
							<div className="mt-3 grid grid-cols-2 gap-2 rounded border border-white/10 bg-zinc-950/40 p-3">
								<p className="col-span-2 text-[11px] font-semibold text-white/80">Accent / Emphasis（強調演出）</p>
								<label className="space-y-1">
									<span className="text-white/60">Accent Effect</span>
									<select
										className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
										value={selectedClip.accent.effect}
										onChange={(event) => updateSelectedClipAccent("effect", event.target.value as AccentEffect)}
									>
										{accentEffects.map((effect) => (
											<option key={`accent-${effect}`} value={effect} className="bg-zinc-700 text-white">
												{effect === "none" ? "None" : "Glitch"}
											</option>
										))}
									</select>
								</label>
								{selectedClip.accent.effect === "glitch" ? (
									<>
										<label className="space-y-1">
											<span className="text-white/60">Trigger Time（開始から秒）</span>
											<input
												type="number"
												step={0.01}
												min={0}
												max={selectedClip.length}
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.accent.triggerTime}
												onChange={(event) => updateSelectedClipAccent("triggerTime", Number(event.target.value))}
											/>
										</label>
										<label className="space-y-1">
											<span className="text-white/60">Duration（持続時間）</span>
											<input
												type="number"
												step={0.01}
												min={0}
												max={Math.max(0, selectedClip.length - selectedClip.accent.triggerTime)}
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.accent.duration}
												onChange={(event) => updateSelectedClipAccent("duration", Number(event.target.value))}
											/>
										</label>
										<label className="col-span-2 space-y-1">
											<span className="text-white/60">Intensity（歪みの強さ 0-1）</span>
											<div className="flex items-center gap-2">
												<input
													type="range"
													step={0.01}
													min={0}
													max={1}
													className="w-full accent-sky-400"
													value={selectedClip.accent.intensity}
													onChange={(event) => updateSelectedClipAccent("intensity", Number(event.target.value))}
												/>
												<input
													type="number"
													step={0.01}
													min={0}
													max={1}
													className="w-24 rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
													value={selectedClip.accent.intensity}
													onChange={(event) => updateSelectedClipAccent("intensity", Number(event.target.value))}
												/>
											</div>
										</label>
									</>
								) : null}
							</div>
							<p className="text-white/60">
								※ Easing は効果が none のときは無効です。既存データで未設定の場合は linear として扱います。
							</p>
							<p className="text-white/60">
								※ AccentのGlitchは in/out 移動とは独立し、指定時刻で 0 → 1 → 0 の強調演出を行います。
							</p>
						</div>
					</section>
				</>
			) : (
				<section className="rounded-lg bg-zinc-900 p-4">
					<p className="text-sm text-amber-300">対象クリップが見つかりません。Editorで再選択してください。</p>
				</section>
			)}
		</main>
	);
}

