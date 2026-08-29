import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { WeddingChoreographyFrame, WeddingSemanticBlock } from "./scene-engine";
import type {
  WeddingLayoutPreset,
  WeddingMotionPreset,
  WeddingSafeZone,
  WeddingLayoutTransforms,
  WeddingTransformBlockId,
} from "./presentation";
import { defaultWeddingTransform, resolveWeddingSafeZone, weddingTransformCss } from "./presentation";

type MotionStyle = CSSProperties & {
  "--wedding-inline-enter": string;
};

type WeddingMotionLayerProps = {
  frame: WeddingChoreographyFrame;
  replayKey: number;
  isPlaying: boolean;
  reduceMotion: boolean;
  settleScene: boolean;
  layout: WeddingLayoutPreset;
  motionPreset: WeddingMotionPreset;
  safeZone: WeddingSafeZone;
  focalY?: number;
  renderBlock: (block: WeddingSemanticBlock) => ReactNode;
  transforms: WeddingLayoutTransforms;
  selectedBlock?: WeddingTransformBlockId;
  onSelectBlock?: (id: WeddingTransformBlockId) => void;
  onMoveBlock?: (id: WeddingTransformBlockId, x: number, y: number) => void;
  onMoveGlobal?: (x: number, y: number) => void;
};

export function WeddingMotionLayer({
  frame,
  replayKey,
  isPlaying,
  reduceMotion,
  settleScene,
  layout,
  motionPreset,
  safeZone,
  focalY,
  renderBlock,
  transforms,
  selectedBlock,
  onSelectBlock,
  onMoveBlock,
  onMoveGlobal,
}: WeddingMotionLayerProps) {
  const rule = layout.scenes.rsvp;
  const vertical = resolveWeddingSafeZone(safeZone, rule.vertical, focalY);
  const resolved = reduceMotion || settleScene || frame.final;
  const dragRef = useRef<{ kind: "global" | WeddingTransformBlockId; pointerId: number; clientX: number; clientY: number; x: number; y: number } | null>(null);
  const startDrag = (event: ReactPointerEvent<HTMLElement>, kind: "global" | WeddingTransformBlockId, transform: { x: number; y: number }) => {
    if (event.button !== 0 || (kind === "global" ? !onMoveGlobal : !onMoveBlock)) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...transform };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const paper = event.currentTarget.closest<HTMLElement>(".wedding-paper");
    if (!paper) return;
    const bounds = paper.getBoundingClientRect();
    const block = drag.kind !== "global";
    const limitX = block ? 0.25 : 0.18;
    const limitY = block ? 0.25 : 0.22;
    const x = Math.max(-limitX, Math.min(limitX, drag.x + (event.clientX - drag.clientX) / bounds.width));
    const y = Math.max(-limitY, Math.min(limitY, drag.y + (event.clientY - drag.clientY) / bounds.height));
    if (drag.kind !== "global") onMoveBlock?.(drag.kind, x, y); else onMoveGlobal?.(x, y);
  };

  return (
    <div
      className={`wedding-motion-layer wedding-layout-vertical--${vertical} wedding-layout-horizontal--${rule.horizontal} wedding-layout-width--${rule.width} is-complete-motion`}
      data-motion-preset={motionPreset.id}
      data-motion-behavior={frame.behavior}
    >
      {onMoveGlobal && <button
        type="button"
        className="wedding-global-drag-handle"
        aria-label="Move overall content"
        onPointerDown={(event) => startDrag(event, "global", transforms.global)}
        onPointerMove={moveDrag}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      ><span aria-hidden="true" /></button>}
      <div
        className={`wedding-choreography wedding-choreography--${frame.behavior} wedding-choreography--${frame.density} is-complete-invitation ${resolved ? "is-resolved" : ""} ${onMoveGlobal ? "is-layout-editable" : ""}`}
        style={{ transform: weddingTransformCss(transforms.global) }}
        data-global-transform={`${transforms.global.scale}:${transforms.global.x}:${transforms.global.y}`}
      >
        {frame.items.map((item) => {
          const style: MotionStyle | undefined = item.phase === "entering" ? {
            "--wedding-inline-enter": frame.direction === "rtl" ? "18px" : "-18px",
            animationDelay: `${item.entersAt - frame.elapsed}ms`,
            animationDuration: `${motionPreset.enterDurationMs}ms`,
            animationPlayState: isPlaying ? "running" : "paused",
          } : undefined;
          return (
            <div
              key={`${item.block.id}:${item.entersAt}:${replayKey}`}
              className={`wedding-choreography-block wedding-choreography-block--${item.block.id} is-${item.phase} is-${item.role} ${item.retained ? "is-retained" : ""}`}
              style={style}
              data-semantic-block={item.block.id}
            >
              <div
                className={`wedding-custom-block ${selectedBlock === item.block.id ? "is-selected" : ""}`}
                style={{ transform: weddingTransformCss(transforms.blocks[item.block.id] ?? defaultWeddingTransform) }}
                data-block-transform={`${transforms.blocks[item.block.id]?.scale ?? 1}:${transforms.blocks[item.block.id]?.x ?? 0}:${transforms.blocks[item.block.id]?.y ?? 0}`}
                onClick={onSelectBlock ? (event) => { event.stopPropagation(); onSelectBlock(item.block.id); } : undefined}
                onPointerDown={onMoveBlock ? (event) => { onSelectBlock?.(item.block.id); startDrag(event, item.block.id, transforms.blocks[item.block.id] ?? defaultWeddingTransform); } : undefined}
                onPointerMove={moveDrag}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
              >
                {renderBlock(item.block)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
