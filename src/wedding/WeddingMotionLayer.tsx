import { useState, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { WeddingChoreographyFrame, WeddingSemanticBlock } from "./scene-engine";
import type {
  WeddingLayoutPreset,
  WeddingMotionPreset,
  WeddingSafeZone,
  WeddingLayoutTransforms,
  WeddingTransformBlockId,
  BlockTransform,
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
  onUpdateBlockTransform?: (id: WeddingTransformBlockId, patch: Partial<BlockTransform>) => void;
  onAutoBalance?: () => void;
  onOpenDirectEdit?: (id: WeddingTransformBlockId) => void;
  entranceStyle?: 'royal-rise' | 'calligraphic-glow' | 'soft-fade' | 'instant';
  entranceSpeed?: 'slow' | 'normal' | 'fast';
};

const LUXURY_PALETTE = [
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Warm Ivory', hex: '#FAF6F0' },
  { name: 'Royal Emerald', hex: '#0D2E24' },
  { name: 'Espresso', hex: '#1C1917' },
  { name: 'Rose Champagne', hex: '#D8A48F' },
];

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
  onUpdateBlockTransform,
  onAutoBalance,
  onOpenDirectEdit,
  entranceStyle = 'royal-rise',
  entranceSpeed = 'normal',
}: WeddingMotionLayerProps) {
  const rule = layout.scenes.rsvp;
  const vertical = resolveWeddingSafeZone(safeZone, rule.vertical, focalY);
  const resolved = reduceMotion || settleScene || frame.final;
  const [isSnapped, setIsSnapped] = useState(false);
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
    let x = Math.max(-limitX, Math.min(limitX, drag.x + (event.clientX - drag.clientX) / bounds.width));
    const y = Math.max(-limitY, Math.min(limitY, drag.y + (event.clientY - drag.clientY) / bounds.height));

    let snapped = false;
    if (block) {
      if (Math.abs(x * bounds.width) <= 8 || Math.abs(x) <= 0.02) {
        x = 0;
        snapped = true;
      }
    }
    setIsSnapped(snapped);

    if (drag.kind !== "global") onMoveBlock?.(drag.kind, x, y);
    else onMoveGlobal?.(x, y);
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsSnapped(false);
  };

  const activeBlockTransform = selectedBlock ? (transforms.blocks[selectedBlock] ?? defaultWeddingTransform) : defaultWeddingTransform;

  const speedMultiplier = entranceSpeed === 'fast' ? 0.7 : entranceSpeed === 'slow' ? 1.4 : 1.0;
  const getBlockDelay = (blockId: string) => {
    let base = 200;
    if (blockId === 'occasion' || blockId === 'hosts') base = 700;
    else if (blockId === 'principals') base = 1300;
    else if (blockId === 'date-time') base = 2000;
    else if (blockId === 'venue') base = 2600;
    else if (blockId === 'rsvp') base = 3100;
    return Math.round(base * speedMultiplier);
  };

  return (
    <div
      className={`wedding-motion-layer wedding-layout-vertical--${vertical} wedding-layout-horizontal--${rule.horizontal} wedding-layout-width--${rule.width} is-complete-motion`}
      data-motion-preset={motionPreset.id}
      data-motion-behavior={frame.behavior}
    >
      {/* Magnetic Center Snap Guide Line */}
      {isSnapped && <div className="wedding-center-snap-guide" aria-hidden="true" />}

      {/* Top-Right Canvas Bar (Global Drag Handle + 1-Tap Auto-Balance) */}
      {onMoveGlobal && (
        <div className="wedding-canvas-tools">
          <button
            type="button"
            className="wedding-global-drag-handle"
            aria-label="Move overall content"
            onPointerDown={(event) => startDrag(event, "global", transforms.global)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span aria-hidden="true" />
          </button>
          {onAutoBalance && (
            <button
              type="button"
              className="wedding-autobalance-btn"
              onClick={onAutoBalance}
              title="ترتيب تلقائي متوازن"
              data-testid="button-auto-balance"
            >
              <span>✨ ترتيب تلقائي</span>
            </button>
          )}
        </div>
      )}

      {/* Direct On-Canvas Floating Mini-Toolbar when a block is selected */}
      {selectedBlock && onUpdateBlockTransform && (
        <div
          className="wedding-floating-toolbar"
          data-testid="wedding-floating-toolbar"
          onClick={(e) => e.stopPropagation()}
        >
          {onOpenDirectEdit && (
            <button
              type="button"
              className="wedding-floating-toolbar-btn"
              onClick={() => onOpenDirectEdit(selectedBlock)}
              title="تعديل النص"
              data-testid="toolbar-edit-text"
            >
              ✏️ تعديل النص
            </button>
          )}

          {/* Scale A- / A+ */}
          <button
            type="button"
            className="wedding-floating-toolbar-btn px-2"
            onClick={() => {
              const currentScale = activeBlockTransform.scale ?? 1;
              const nextScale = Math.max(0.75, Math.round((currentScale - 0.08) * 100) / 100);
              onUpdateBlockTransform(selectedBlock, { scale: nextScale });
            }}
            title="تصغير الحجم"
            data-testid="toolbar-scale-down"
          >
            A-
          </button>
          <button
            type="button"
            className="wedding-floating-toolbar-btn px-2"
            onClick={() => {
              const currentScale = activeBlockTransform.scale ?? 1;
              const nextScale = Math.min(1.35, Math.round((currentScale + 0.08) * 100) / 100);
              onUpdateBlockTransform(selectedBlock, { scale: nextScale });
            }}
            title="تكبير الحجم"
            data-testid="toolbar-scale-up"
          >
            A+
          </button>

          {/* Color Swatches */}
          <div className="flex items-center gap-1 px-1">
            {LUXURY_PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`wedding-color-swatch ${activeBlockTransform.color === c.hex ? 'is-active' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => onUpdateBlockTransform(selectedBlock, { color: c.hex })}
                title={c.name}
              />
            ))}
            <label className="relative flex items-center justify-center cursor-pointer">
              <span className="sr-only">لون مخصص</span>
              <input
                type="color"
                value={activeBlockTransform.color || '#D4AF37'}
                onChange={(e) => onUpdateBlockTransform(selectedBlock, { color: e.target.value })}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <span className="wedding-color-swatch flex items-center justify-center bg-gradient-to-tr from-amber-400 via-rose-300 to-emerald-400 text-[9px] font-bold text-black/70">
                🎨
              </span>
            </label>
          </div>

          {/* Center */}
          <button
            type="button"
            className="wedding-floating-toolbar-btn px-2"
            onClick={() => {
              onUpdateBlockTransform(selectedBlock, { x: 0 });
            }}
            title="توسيط أفقي"
            data-testid="toolbar-center-block"
          >
            ⌖ توسيط
          </button>

          {/* Reset */}
          <button
            type="button"
            className="wedding-floating-toolbar-btn px-2 text-[#E5C368]"
            onClick={() => {
              onUpdateBlockTransform(selectedBlock, { scale: 1, x: 0, y: 0, color: undefined, hidden: false });
            }}
            title="إعادة ضبط"
            data-testid="toolbar-reset-block"
          >
            ↺ إعادة
          </button>
        </div>
      )}

      <div
        className={`wedding-choreography wedding-choreography--${frame.behavior} wedding-choreography--${frame.density} is-complete-invitation ${resolved ? "is-resolved" : ""} ${onMoveGlobal ? "is-layout-editable" : ""}`}
        style={{ transform: weddingTransformCss(transforms.global) }}
        data-global-transform={`${transforms.global.scale}:${transforms.global.x}:${transforms.global.y}`}
      >
        {frame.items.map((item) => {
          const blockTransform = transforms.blocks[item.block.id] ?? defaultWeddingTransform;
          if (blockTransform.hidden) return null;

          const isEntering = item.phase === "entering" && !resolved;
          const entranceDelayMs = getBlockDelay(item.block.id);
          const style: MotionStyle | undefined = isEntering ? {
            "--wedding-inline-enter": frame.direction === "rtl" ? "18px" : "-18px",
            animationDelay: `${entranceDelayMs}ms`,
            animationDuration: `${motionPreset.enterDurationMs}ms`,
            animationPlayState: isPlaying ? "running" : "paused",
          } : undefined;

          const blockStyle: CSSProperties = {
            transform: weddingTransformCss(blockTransform),
            ...(blockTransform.color ? { color: blockTransform.color, '--wedding-accent': blockTransform.color } as CSSProperties : {}),
          };

          const entranceClass = isEntering && entranceStyle ? `wedding-entrance--${entranceStyle}` : '';

          return (
            <div
              key={`${item.block.id}:${item.entersAt}:${replayKey}`}
              className={`wedding-choreography-block wedding-choreography-block--${item.block.id} is-${item.phase} is-${item.role} ${item.retained ? "is-retained" : ""} ${entranceClass}`}
              style={style}
              data-semantic-block={item.block.id}
            >
              <div
                className={`wedding-custom-block ${selectedBlock === item.block.id ? "is-selected" : ""}`}
                style={blockStyle}
                data-block-transform={`${blockTransform.scale}:${blockTransform.x}:${blockTransform.y}`}
                onClick={onSelectBlock ? (event) => { event.stopPropagation(); onSelectBlock(item.block.id); } : undefined}
                onPointerDown={onMoveBlock ? (event) => { onSelectBlock?.(item.block.id); startDrag(event, item.block.id, blockTransform); } : undefined}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
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
