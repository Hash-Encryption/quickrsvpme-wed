import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { invitationT } from "../i18n/invitation";
import { localeDirection, type InvitationLocale } from "../i18n/locale";
import {
  getWeddingSceneIndex,
  type WeddingScene,
  type WeddingSceneTiming,
} from "./scene-engine";

type WeddingSceneEngineProps = {
  scenes: ReadonlyArray<WeddingScene>;
  timings: ReadonlyArray<WeddingSceneTiming>;
  cueTimes: ReadonlyArray<number>;
  timelineEnd: number;
  musicUrl?: string;
  backgroundMediaUrl?: string;
  preview?: boolean;
  style?: CSSProperties;
  overlay?: ReactNode;
  renderScene: (
    scene: WeddingScene,
    playback: {
      elapsed: number;
      isPlaying: boolean;
      reduceMotion: boolean;
      settleScene: boolean;
      replayKey: number;
    },
  ) => ReactNode;
  locale: InvitationLocale;
};

export function WeddingSceneEngine({
  scenes,
  timings,
  cueTimes,
  timelineEnd,
  musicUrl,
  backgroundMediaUrl,
  preview = false,
  style,
  overlay,
  renderScene,
  locale,
}: WeddingSceneEngineProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const audioRef = useRef<HTMLAudioElement>(null);
  const elapsedRef = useRef(0);
  const startedAtRef = useRef(performance.now());
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!reduceMotion);
  const [isMuted, setIsMuted] = useState(true);
  const [settleScene, setSettleScene] = useState(reduceMotion);
  const [replayKey, setReplayKey] = useState(0);
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
    setSettleScene(true);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !isPlaying) return;
    const nextCue = cueTimes.find((startsAt) => startsAt > elapsedRef.current);
    if (nextCue === undefined) {
      setIsPlaying(false);
      return;
    }
    const delay = nextCue - elapsedRef.current;
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
  }, [cueTimes, elapsed, isPlaying, reduceMotion, timelineEnd]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    if (isMuted || !isPlaying) audio.pause();
    else void audio.play().catch(() => setIsMuted(true));
  }, [isMuted, isPlaying, musicUrl]);

  const replay = () => {
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPosition(0);
    setReplayKey((value) => value + 1);
    setIsPlaying(!reduceMotion);
    setSettleScene(reduceMotion);
  };

  const goToScene = (index: number) => {
    setIsPlaying(false);
    setSettleScene(true);
    setPosition(index === timings.length - 1
      ? timelineEnd
      : timings[index]?.startsAt ?? 0);
  };

  const togglePlayback = () => {
    if (reduceMotion) {
      goToScene((activeSceneIndex + 1) % timings.length);
      return;
    }
    if (!isPlaying && elapsedRef.current >= timelineEnd) {
      replay();
      return;
    }
    if (isPlaying) {
      setPosition(
        Math.min(timelineEnd, performance.now() - startedAtRef.current),
      );
      setIsPlaying(false);
      setSettleScene(false);
    } else {
      startedAtRef.current = performance.now() - elapsedRef.current;
      setSettleScene(false);
      setIsPlaying(true);
    }
  };

  return (
    <section
      className={`wedding-stage ${preview ? "wedding-stage--preview" : ""}`}
      style={style}
      dir={localeDirection(locale)}
      lang={locale}
      aria-label={invitationT(locale, "invitation")}
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

      {activeScene && renderScene(activeScene, {
        elapsed,
        isPlaying,
        reduceMotion,
        settleScene,
        replayKey,
      })}

      <div className="wedding-controls" aria-label={invitationT(locale, "controls")}>
        <button
          onClick={togglePlayback}
          aria-label={
            reduceMotion
              ? invitationT(locale, "nextScene")
              : isPlaying
                ? invitationT(locale, "pause")
                : invitationT(locale, "play")
          }
        >
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button onClick={replay} aria-label={invitationT(locale, "replay")}>
          <RotateCcw />
        </button>
        <button
          onClick={() => musicUrl && setIsMuted((value) => !value)}
          disabled={!musicUrl}
          aria-label={invitationT(locale, isMuted ? "soundOn" : "soundOff")}
        >
          {isMuted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>

      <div className="wedding-progress" aria-label={invitationT(locale, "scenes")}>
        {timings.map((scene, index) => (
          <button
            key={scene.id}
            className={activeSceneIndex === index ? "is-active" : ""}
            onClick={() => goToScene(index)}
            aria-label={`${invitationT(locale, "scene")} ${index + 1} ${invitationT(locale, "of")} ${timings.length}`}
            aria-current={activeSceneIndex === index ? "step" : undefined}
          />
        ))}
      </div>

      {overlay}
    </section>
  );
}
