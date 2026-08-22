import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type {
  WeddingLayoutPreset,
  WeddingMotionPreset,
  WeddingSceneId,
} from "./presentation";
import { resolveWeddingMotionTarget } from "./presentation";

type WeddingMotionLayerProps = {
  children: ReactNode;
  sceneId: WeddingSceneId;
  replayKey: number;
  layout: WeddingLayoutPreset;
  motionPreset: WeddingMotionPreset;
  direction?: "rtl" | "ltr";
};

export function WeddingMotionLayer({
  children,
  sceneId,
  replayKey,
  layout,
  motionPreset,
  direction = "rtl",
}: WeddingMotionLayerProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const rule = layout.scenes[sceneId];
  const target = (state: WeddingMotionPreset["active"]) =>
    resolveWeddingMotionTarget(state, direction, reduceMotion);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${sceneId}:${replayKey}`}
        className={`wedding-motion-layer wedding-layout-vertical--${rule.vertical} wedding-layout-horizontal--${rule.horizontal} wedding-layout-width--${rule.width}`}
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
