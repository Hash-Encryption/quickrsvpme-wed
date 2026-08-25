import type { CSSProperties, ReactNode } from "react";
import type { WeddingChoreographyFrame, WeddingSemanticBlock } from "./scene-engine";
import type {
  WeddingLayoutPreset,
  WeddingMotionPreset,
  WeddingSafeZone,
} from "./presentation";
import { resolveWeddingSafeZone } from "./presentation";

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
}: WeddingMotionLayerProps) {
  const rule = layout.scenes.rsvp;
  const vertical = resolveWeddingSafeZone(safeZone, rule.vertical, focalY);
  const resolved = reduceMotion || settleScene || frame.final;

  return (
    <div
      className={`wedding-motion-layer wedding-layout-vertical--${vertical} wedding-layout-horizontal--${rule.horizontal} wedding-layout-width--${rule.width} is-complete-motion`}
      data-motion-preset={motionPreset.id}
      data-motion-behavior={frame.behavior}
    >
      <div className={`wedding-choreography wedding-choreography--${frame.behavior} wedding-choreography--${frame.density} is-complete-invitation ${resolved ? "is-resolved" : ""}`}>
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
              {renderBlock(item.block)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
