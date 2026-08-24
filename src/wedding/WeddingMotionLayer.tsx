import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type {
  WeddingLayoutPreset,
  WeddingMotionPreset,
  WeddingSafeZone,
  WeddingSceneId,
} from "./presentation";
import { resolveWeddingMotionTarget, resolveWeddingSafeZone } from "./presentation";

type WeddingMotionLayerProps = {
  children: ReactNode;
  sceneId: WeddingSceneId;
  replayKey: number;
  layout: WeddingLayoutPreset;
  motionPreset: WeddingMotionPreset;
  safeZone: WeddingSafeZone;
  focalY?: number;
  direction?: "rtl" | "ltr";
};

export function WeddingMotionLayer({
  children,
  sceneId,
  replayKey,
  layout,
  motionPreset,
  safeZone,
  focalY,
  direction = "rtl",
}: WeddingMotionLayerProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const rule = layout.scenes[sceneId];
  const vertical = resolveWeddingSafeZone(safeZone, rule.vertical, focalY);
  const target = (state: WeddingMotionPreset["active"]) =>
    resolveWeddingMotionTarget(state, direction, reduceMotion);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${sceneId}:${replayKey}`}
        className={`wedding-motion-layer wedding-layout-vertical--${vertical} wedding-layout-horizontal--${rule.horizontal} wedding-layout-width--${rule.width}`}
        initial={target(motionPreset.enter)}
        animate={{
          ...target(motionPreset.active),
          transition: reduceMotion
            ? { duration: 0 }
            : motionPreset.enterTransition,
        }}
        exit={{
          ...target(motionPreset.exit),
          transition: reduceMotion
            ? { duration: 0 }
            : motionPreset.exitTransition,
        }}
        data-motion-preset={motionPreset.id}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
