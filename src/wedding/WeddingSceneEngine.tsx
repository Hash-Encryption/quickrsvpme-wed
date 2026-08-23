import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  getWeddingRemainingDelay,
  getWeddingSceneIndex,
  type WeddingScene,
  type WeddingSceneTiming,
} from "./scene-engine";

type WeddingSceneEngineProps = {
  scenes: ReadonlyArray<WeddingScene>;
  timings: ReadonlyArray<WeddingSceneTiming>;
  musicUrl?: string;
  backgroundMediaUrl?: string;
  preview?: boolean;
  style?: CSSProperties;
  overlay?: ReactNode;
  renderScene: (scene: WeddingScene, replayKey: number) => ReactNode;
};

export function WeddingSceneEngine({
  scenes,
  timings,
  musicUrl,
  backgroundMediaUrl,
  preview = false,
  style,
  overlay,
  renderScene,
}: WeddingSceneEngineProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const audioRef = useRef<HTMLAudioElement>(null);
  const elapsedRef = useRef(0);
  const startedAtRef = useRef(performance.now());
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!reduceMotion);
  const [isMuted, setIsMuted] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const timelineEnd = timings.at(-1)?.startsAt ?? 0;
  const activeSceneIndex = getWeddingSceneIndex(timings, elapsed);
  const activeScene = scenes[activeSceneIndex] ?? scenes[0];

  const setPosition = (position: number) => {
    elapsedRef.current = position;
    setElapsed(position);
  };

  useEffect(() => {
    if (!reduceMotion) return;
    setPosition(0);
    setIsPlaying(false);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !isPlaying) return;
    const delay = getWeddingRemainingDelay(timings, elapsedRef.current);
    if (delay === null) {
      setIsPlaying(false);
      return;
    }
    startedAtRef.current = performance.now() - elapsedRef.current;
    const timer = window.setTimeout(() => {
      const position = Math.min(
        timelineEnd,
        performance.now() - startedAtRef.current,
      );
      setPosition(position);
      if (position >= timelineEnd) setIsPlaying(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [elapsed, isPlaying, reduceMotion, timelineEnd, timings]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    if (isMuted || !isPlaying) audio.pause();
    else void audio.play().catch(() => setIsMuted(true));
  }, [isMuted, isPlaying, musicUrl]);

  const replay = () => {
    setPosition(0);
    setReplayKey((value) => value + 1);
    setIsPlaying(!reduceMotion);
  };

  const goToScene = (index: number) => {
    setIsPlaying(false);
    setPosition(timings[index]?.startsAt ?? 0);
  };

  const togglePlayback = () => {
    if (reduceMotion) {
      goToScene((activeSceneIndex + 1) % timings.length);
      return;
    }
    if (activeSceneIndex === timings.length - 1) {
      replay();
      return;
    }
    if (isPlaying) {
      setPosition(
        Math.min(timelineEnd, performance.now() - startedAtRef.current),
      );
      setIsPlaying(false);
    } else {
      startedAtRef.current = performance.now() - elapsedRef.current;
      setIsPlaying(true);
    }
  };

  return (
    <section
      className={`wedding-stage ${preview ? "wedding-stage--preview" : ""}`}
      style={style}
      dir="rtl"
      aria-label="دعوة زفاف"
      data-scene={activeScene?.id}
    >
      {backgroundMediaUrl && (
        <video
          className="wedding-background-video"
          src={backgroundMediaUrl}
          autoPlay={!reduceMotion}
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      )}
      {musicUrl && <audio ref={audioRef} src={musicUrl} loop preload="none" />}

      {activeScene && renderScene(activeScene, replayKey)}

      <div className="wedding-controls" aria-label="عناصر تحكم الدعوة">
        <button
          onClick={togglePlayback}
          aria-label={
            reduceMotion
              ? "المشهد التالي"
              : isPlaying
                ? "إيقاف العرض مؤقتاً"
                : "تشغيل العرض"
          }
        >
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button onClick={replay} aria-label="إعادة العرض">
          <RotateCcw />
        </button>
        <button
          onClick={() => musicUrl && setIsMuted((value) => !value)}
          disabled={!musicUrl}
          aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {isMuted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>

      <div className="wedding-progress" aria-label="مشاهد الدعوة">
        {timings.map((scene, index) => (
          <button
            key={scene.id}
            className={activeSceneIndex === index ? "is-active" : ""}
            onClick={() => goToScene(index)}
            aria-label={`المشهد ${index + 1} من ${timings.length}`}
            aria-current={activeSceneIndex === index ? "step" : undefined}
          />
        ))}
      </div>

      {overlay}
    </section>
  );
}
