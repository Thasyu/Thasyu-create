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
import { Player } from "@remotion/player";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import * as THREE from "three";

type TransitionType = "none" | "fade" | "dissolve" | "slide" | "glitch" | "pixelate" | "rgbShift";

type ClipTransitionPoint = {
	duration: number;
	effect: TransitionType;
};

type ClipTransitions = {
	inPoint: ClipTransitionPoint;
	outPoint: ClipTransitionPoint;
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
	positionX: number;
	positionY: number;
	transitions: ClipTransitions;
};

type TrimEdge = "start" | "end";

type TrimState = {
	clipId: string;
	edge: TrimEdge;
	startX: number;
	originStart: number;
	originLength: number;
};

type LayerState = {
	baseClip?: ClipItem;
	overlayClip?: ClipItem;
	baseLocalTime: number;
	overlayLocalTime: number;
	progress: number;
	effectType: TransitionType;
	hasOverlay: boolean;
};

const FPS = 30;
const PIXELS_PER_SECOND = 80;
const TRACK_COUNT = 4;
const MIN_CLIP_LENGTH = 0.25;

const transitionTypes: TransitionType[] = [
	"none",
	"fade",
	"dissolve",
	"slide",
	"glitch",
	"pixelate",
	"rgbShift",
];

const textAssets: TextAsset[] = [
	{ id: "asset-title", name: "Title", text: "NEW EPISODE", color: "#ffffff", fontSize: 82 },
	{ id: "asset-sub", name: "Subtitle", text: "Powered by Character Transitions", color: "#7dd3fc", fontSize: 44 },
	{ id: "asset-call", name: "Callout", text: "LIMITED TIME", color: "#fca5a5", fontSize: 64 },
];

const initialClips: ClipItem[] = [
	{
		id: "clip-1",
		assetId: "asset-title",
		name: "Title",
		text: "NEW EPISODE",
		start: 0.5,
		length: 3.5,
		track: 0,
		zIndex: 1,
		color: "#ffffff",
		fontSize: 84,
		positionX: 0.5,
		positionY: 0.45,
		transitions: {
			inPoint: { duration: 0.6, effect: "dissolve" },
			outPoint: { duration: 0.8, effect: "rgbShift" },
		},
	},
	{
		id: "clip-2",
		assetId: "asset-sub",
		name: "Subtitle",
		text: "Powered by Character Transitions",
		start: 2,
		length: 4,
		track: 1,
		zIndex: 2,
		color: "#7dd3fc",
		fontSize: 42,
		positionX: 0.5,
		positionY: 0.65,
		transitions: {
			inPoint: { duration: 0.5, effect: "slide" },
			outPoint: { duration: 1, effect: "glitch" },
		},
	},
];

const effectCodeMap: Record<TransitionType, number> = {
	none: 0,
	fade: 1,
	dissolve: 2,
	slide: 3,
	glitch: 4,
	pixelate: 5,
	rgbShift: 6,
};

const clamp = (value: number, min: number, max: number): number => {
	return Math.min(Math.max(value, min), max);
};

const quantizeQuarter = (value: number): number => {
	return Math.round(value * 4) / 4;
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

const getLayerState = (clips: ClipItem[], currentTime: number): LayerState => {
	const activeClips = clips
		.filter((clip) => currentTime >= clip.start && currentTime <= clip.start + clip.length)
		.sort((a, b) => b.zIndex - a.zIndex);

	if (activeClips.length === 0) {
		return {
			baseLocalTime: 0,
			overlayLocalTime: 0,
			progress: 0,
			effectType: "none",
			hasOverlay: false,
		};
	}

	const overlayClip = activeClips[0];
	const baseClip = activeClips[1] ?? activeClips[0];
	return {
		baseClip,
		overlayClip,
		baseLocalTime: clamp(currentTime - baseClip.start, 0, baseClip.length),
		overlayLocalTime: clamp(currentTime - overlayClip.start, 0, overlayClip.length),
		progress: getTransitionProgress(overlayClip, currentTime),
		effectType: resolveActiveTransitionEffect(overlayClip, currentTime),
		hasOverlay: activeClips.length > 1,
	};
};

const drawTextClip = (
	context: CanvasRenderingContext2D,
	sourceCanvas: HTMLCanvasElement,
	clip: ClipItem | undefined,
	localTime: number
): void => {
	context.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
	if (!clip) {
		return;
	}

	const alpha = clip.length > 0 ? clamp(1 - Math.max(0, localTime - clip.length), 0, 1) : 1;
	const x = clamp(clip.positionX, 0, 1) * sourceCanvas.width;
	const y = clamp(clip.positionY, 0, 1) * sourceCanvas.height;

	context.globalAlpha = alpha;
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillStyle = clip.color;
	context.font = `700 ${Math.max(12, clip.fontSize)}px sans-serif`;
	context.shadowColor = "rgba(0,0,0,0.45)";
	context.shadowBlur = 14;
	context.fillText(clip.text, x, y);
	context.globalAlpha = 1;
	context.shadowBlur = 0;
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

			vec4 applyDissolve(vec4 under, vec4 over, vec2 uv, float p) {
				float n = random(floor(uv * 240.0) + vec2(u_time));
				float mask = step(n, p);
				return mix(under, over, mask);
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
					outColor = applyDissolve(under, over, uv, u_progress);
				} else if (u_effectType < 3.5) {
					outColor = applySlide(under, uv, u_progress);
				} else if (u_effectType < 4.5) {
					outColor = applyGlitch(under, over, uv, u_progress);
				} else if (u_effectType < 5.5) {
					outColor = applyPixelate(under, uv, u_progress);
				} else if (u_effectType < 6.5) {
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
		drawTextClip(contextA, sourceCanvasA, layerState.baseClip, layerState.baseLocalTime);

		contextB.clearRect(0, 0, sourceCanvasB.width, sourceCanvasB.height);
		drawTextClip(contextB, sourceCanvasB, layerState.overlayClip, layerState.overlayLocalTime);

		textureA.needsUpdate = true;
		textureB.needsUpdate = true;
		uniforms.u_time.value = state.clock.elapsedTime;
		uniforms.u_progress.value = layerState.progress;
		uniforms.u_effectType.value = effectCodeMap[layerState.effectType];
		uniforms.u_hasOverlay.value = layerState.hasOverlay ? 1 : 0;
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

const TimelineComposition = ({ clips }: { clips: ClipItem[] }) => {
	const frame = useCurrentFrame();
	const currentTime = frame / FPS;
	const layerState = getLayerState(clips, currentTime);

	return (
		<AbsoluteFill style={{ background: "#0f172a", overflow: "hidden" }}>
			<Sequence from={0} durationInFrames={Math.max(1, Math.ceil((clips.length + 2) * FPS * 4))}>
				<ShaderCanvasLayer layerState={layerState} />
			</Sequence>
		</AbsoluteFill>
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
	onSelect,
	onTrimStart,
}: {
	clip: ClipItem;
	selected: boolean;
	onSelect: (id: string) => void;
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
				onClick={() => onSelect(clip.id)}
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
					onClick={() => onSelect(clip.id)}
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
	const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
	const trimRef = useRef<TrimState | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastFrameTimeRef = useRef<number | null>(null);
	const [mounted, setMounted] = useState(false);

	const [clips, setClips] = useState<ClipItem[]>(initialClips);
	const [selectedClipId, setSelectedClipId] = useState<string>(initialClips[0].id);
	const [selectedAssetId, setSelectedAssetId] = useState<string>(textAssets[0].id);
	const [currentTime, setCurrentTime] = useState<number>(0);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [isExporting, setIsExporting] = useState<boolean>(false);
	const [exportError, setExportError] = useState<string | null>(null);
	const [exportUrl, setExportUrl] = useState<string | null>(null);

	const sensors = useSensors(useSensor(PointerSensor));

	useEffect(() => {
		setMounted(true);
	}, []);

	const duration = useMemo(() => {
		return Math.max(8, ...clips.map((clip) => clip.start + clip.length + 0.5));
	}, [clips]);

	const durationInFrames = useMemo(() => Math.ceil(duration * FPS), [duration]);
	const safeInitialFrame = useMemo(
		() => clamp(Math.floor(currentTime * FPS), 0, Math.max(0, durationInFrames - 1)),
		[currentTime, durationInFrames]
	);

	const selectedClip = useMemo(() => {
		return clips.find((clip) => clip.id === selectedClipId) ?? clips[0];
	}, [clips, selectedClipId]);

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

	const updateSelectedClip = useCallback(
		<K extends keyof ClipItem>(key: K, value: ClipItem[K]) => {
			if (!selectedClipId) {
				return;
			}
			setClips((prev) =>
				prev.map((clip) => (clip.id === selectedClipId ? { ...clip, [key]: value } : clip))
			);
		},
		[selectedClipId]
	);

	const updateSelectedClipTransitions = useCallback(
		(point: keyof ClipTransitions, field: keyof ClipTransitionPoint, value: number | TransitionType) => {
			if (!selectedClipId) {
				return;
			}

			setClips((prev) =>
				prev.map((clip) => {
					if (clip.id !== selectedClipId) {
						return clip;
					}

					if (field === "duration") {
						return {
							...clip,
							transitions: {
								...clip.transitions,
								[point]: {
									...clip.transitions[point],
									duration: clamp(Number(value), 0, clip.length),
								},
							},
						};
					}

					return {
						...clip,
						transitions: {
							...clip.transitions,
							[point]: {
								...clip.transitions[point],
								effect: value as TransitionType,
							},
						},
					};
				})
			);
		},
		[selectedClipId]
	);

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
				positionX: 0.5,
				positionY: 0.5,
				transitions: {
					inPoint: { duration: 0, effect: "none" },
					outPoint: { duration: 0, effect: "none" },
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

	if (!mounted) {
		return (
			<main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-6 text-white">
				<section className="rounded-lg bg-zinc-900 p-4">
					<h1 className="text-lg font-semibold">Text Transition Editor</h1>
					<p className="mt-1 text-sm text-white/70">エディターを初期化しています...</p>
				</section>
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-6 text-white">
			<section className="rounded-lg bg-zinc-900 p-4">
				<h1 className="text-lg font-semibold">Text Transition Editor</h1>
				<p className="mt-1 text-sm text-white/70">テキスト専用トランジションシステムで編集します。</p>
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

						<h2 className="pt-2 text-sm font-semibold text-white/80">Remotion Preview</h2>
						<div className="aspect-video overflow-hidden rounded border border-white/10 bg-black">
							<Player
								component={TimelineComposition}
								inputProps={{ clips }}
								durationInFrames={durationInFrames}
								fps={FPS}
								acknowledgeRemotionLicense
								compositionWidth={640}
								compositionHeight={360}
								controls
								initialFrame={safeInitialFrame}
								style={{ width: "100%", height: "100%" }}
							/>
						</div>

						<div className="rounded border border-white/10 bg-black/30 p-3">
							<h3 className="text-xs font-semibold text-white/80">Text Settings</h3>
							{selectedClip ? (
								<div className="mt-2 space-y-2 text-xs">
									<label className="space-y-1">
										<span className="text-white/60">テキスト</span>
										<input
											type="text"
											className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
											value={selectedClip.text}
											onChange={(event) => updateSelectedClip("text", event.target.value)}
										/>
									</label>
									<div className="grid grid-cols-2 gap-2">
										<label className="space-y-1">
											<span className="text-white/60">文字サイズ</span>
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
											<span className="text-white/60">文字色</span>
											<input
												type="color"
												className="h-8 w-full rounded border border-white/20 bg-zinc-700 px-1 py-1"
												value={selectedClip.color}
												onChange={(event) => updateSelectedClip("color", event.target.value)}
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
									</div>
								</div>
							) : (
								<p className="mt-2 text-xs text-white/60">クリップを選択してください。</p>
							)}
						</div>

						<div className="rounded border border-white/10 bg-black/30 p-3">
							<h3 className="text-xs font-semibold text-white/80">Effect Settings</h3>
							{selectedClip ? (
								<div className="mt-2 space-y-2 text-xs">
									<div className="grid grid-cols-2 gap-2">
										<label className="space-y-1">
											<span className="text-white/60">イン点 効果</span>
											<select
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.transitions.inPoint.effect}
												onChange={(event) =>
													updateSelectedClipTransitions(
														"inPoint",
														"effect",
														event.target.value as TransitionType
													)
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
											<span className="text-white/60">イン点 秒数</span>
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
										<label className="space-y-1">
											<span className="text-white/60">アウト点 効果</span>
											<select
												className="w-full rounded border border-white/20 bg-zinc-700 px-2 py-1 text-white"
												value={selectedClip.transitions.outPoint.effect}
												onChange={(event) =>
													updateSelectedClipTransitions(
														"outPoint",
														"effect",
														event.target.value as TransitionType
													)
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
											<span className="text-white/60">アウト点 秒数</span>
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
									</div>
								</div>
							) : (
								<p className="mt-2 text-xs text-white/60">クリップを選択してください。</p>
							)}
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
												onSelect={setSelectedClipId}
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
										positionX,
										positionY,
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
										positionX,
										positionY,
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
		</main>
	);
}
