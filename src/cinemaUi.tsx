import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  PRE_SHOW_SLIDES,
  PROGRAM_ACTS,
  PROGRAM_SCENES,
  SOUNDTRACK_AUDIO_SRC,
  type ProgramScene,
  type ShowAct,
} from './cinemaProgram';
import { playProjectorStartup, unlockCinemaAudio } from './cinemaAudio';
import { ClueLogo } from './clueLogo';

export function PreShowOverlay({ onComplete }: { onComplete: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [dimLevel, setDimLevel] = useState(0);
  const slide = PRE_SHOW_SLIDES[slideIndex];

  useEffect(() => {
    unlockCinemaAudio().catch(() => undefined);
    const dimTimer = window.setTimeout(() => setDimLevel(1), 120);
    const startupTimer = window.setTimeout(() => playProjectorStartup(), 420);

    return () => {
      window.clearTimeout(dimTimer);
      window.clearTimeout(startupTimer);
    };
  }, []);

  useEffect(() => {
    if (!slide) {
      onComplete();
      return;
    }

    const timer = window.setTimeout(() => {
      if (slideIndex >= PRE_SHOW_SLIDES.length - 1) {
        setDimLevel(0);
        window.setTimeout(onComplete, 520);
        return;
      }

      setSlideIndex((current) => current + 1);
    }, slide.durationMs);

    return () => window.clearTimeout(timer);
  }, [onComplete, slide, slideIndex]);

  if (!slide) {
    return null;
  }

  return (
    <section className={`preshow ${dimLevel ? 'preshow--dim' : ''}`} aria-live="polite">
      <div className="preshow__vignette" />
      <article className={`preshow__slide preshow__slide--${slide.kind}`}>
        {slide.kicker && <p className="preshow__kicker">{slide.kicker}</p>}
        <h1>{slide.title}</h1>
        {slide.subtitle && <p>{slide.subtitle}</p>}
        <div className="preshow__grain" aria-hidden="true" />
      </article>
      <div className="preshow__progress" aria-hidden="true">
        {PRE_SHOW_SLIDES.map((entry, index) => (
          <span key={entry.id} className={index <= slideIndex ? 'active' : ''} />
        ))}
      </div>
    </section>
  );
}

export function ProgramHud({
  act,
  selectedSeatLabel,
  collectedCount,
  totalScenes,
}: {
  act: ShowAct;
  selectedSeatLabel: string | null;
  collectedCount: number;
  totalScenes: number;
}) {
  const activeActIndex = Math.max(
    0,
    PROGRAM_ACTS.findIndex((entry) => entry.id === act),
  );
  const actCopy: Record<ShowAct, { title: string; body: string }> = {
    preshow: {
      title: 'House lights down',
      body: 'The projector is warming up.',
    },
    lobby: {
      title: 'Act I — Lobby',
      body: 'Choose a seat on the map to enter the auditorium.',
    },
    auditorium: {
      title: 'Act II — Auditorium',
      body: selectedSeatLabel
        ? `${selectedSeatLabel} · ${collectedCount}/${totalScenes} scenes found`
        : `Find the hidden scenes · ${collectedCount}/${totalScenes}`,
    },
    backstage: {
      title: 'Act III — Backstage',
      body: 'You found the board behind the screen.',
    },
  };

  const copy = actCopy[act];

  return (
    <section className="hud program-hud">
      <p className="eyebrow">Ollie Birthday Cinema</p>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <ol className="program-hud__acts">
        {PROGRAM_ACTS.map((entry, index) => (
          <li
            key={entry.id}
            className={
              index < activeActIndex ? 'done' : index === activeActIndex ? 'active' : ''
            }
          >
            <span>{entry.label}</span>
            <strong>{entry.subtitle}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function SceneAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeeking = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [src]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [src]);

  function syncDuration() {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) {
      return;
    }

    setDuration(audio.duration);
  }

  function handlePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    unlockCinemaAudio().catch(() => undefined);
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }

  function handlePause() {
    audioRef.current?.pause();
  }

  function handleStop() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function handleSeek(nextTime: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const clamped = Math.max(0, Math.min(nextTime, duration || nextTime));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }

  const canStop = isPlaying || currentTime > 0;

  return (
    <div className="festival-handbook__audio">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={syncDuration}
        onDurationChange={syncDuration}
        onTimeUpdate={() => {
          if (!isSeeking.current && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }}
      />
      <div className="festival-handbook__audio-progress">
        <input
          className="festival-handbook__audio-range"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!duration}
          aria-label="Audio progress"
          style={
            {
              '--audio-progress': `${duration ? (currentTime / duration) * 100 : 0}%`,
            } as CSSProperties
          }
          onPointerDown={() => {
            isSeeking.current = true;
          }}
          onPointerUp={() => {
            isSeeking.current = false;
          }}
          onInput={(event) => handleSeek(Number(event.currentTarget.value))}
          onChange={(event) => handleSeek(Number(event.currentTarget.value))}
        />
        <div className="festival-handbook__audio-times">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
      <div className="festival-handbook__audio-controls">
        <button type="button" onClick={handlePlay} disabled={isPlaying}>
          Play
        </button>
        <button type="button" onClick={handlePause} disabled={!isPlaying}>
          Pause
        </button>
        <button type="button" onClick={handleStop} disabled={!canStop}>
          Stop
        </button>
      </div>
    </div>
  );
}

export function FestivalSceneCard({
  scene,
  onClose,
}: {
  scene: ProgramScene;
  onClose: () => void;
}) {
  const [row, seat] = scene.seatId.split(':');

  return (
    <section className="mystery-card-overlay festival-handbook-overlay" aria-live="polite" onClick={onClose}>
      <article
        className={`festival-handbook festival-handbook--${scene.palette}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="festival-handbook__stage">
          <div className="festival-handbook__folds">
            <div className="festival-handbook__wing festival-handbook__wing--left" aria-hidden="true" />
            <div className="festival-handbook__wing festival-handbook__wing--right" aria-hidden="true" />
            <section className="festival-handbook__leaf">
              <header className="festival-handbook__head">
                <div className="festival-handbook__emblem">
                  <ClueLogo symbol={scene.symbol} palette={scene.palette} />
                </div>
                <div>
                  <p className="festival-handbook__kicker">
                    Short {String(scene.order).padStart(2, '0')}
                    {' · '}
                    {scene.isPlaceholder ? 'Coming Soon' : 'Official Selection'}
                  </p>
                  <h2>{scene.title}</h2>
                </div>
              </header>
              <div className="festival-handbook__meta">
                <span>{scene.festivalTag}</span>
                <span>{scene.runtime}</span>
                <span>Row {row} · Seat {seat}</span>
              </div>
              <p className="festival-handbook__synopsis">{scene.hint}</p>
              <div className="festival-handbook__details">
                <p>
                  <span>Director&apos;s note</span>
                  {scene.directorNote}
                </p>
              </div>
              <SceneAudioPlayer src={scene.audioSrc} />
            </section>
          </div>
        </div>
        <footer className="festival-handbook__footer">
          <button type="button" onClick={onClose}>Fold program · return to auditorium</button>
        </footer>
      </article>
    </section>
  );
}

export function SceneAlbumPanel({
  collectedSeatIds,
  isOpen,
  onToggle,
  onOpenScene,
}: {
  collectedSeatIds: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
  onOpenScene: (seatId: string) => void;
}) {
  return (
    <aside className={`ticket-album ${isOpen ? 'open' : ''}`}>
      <button className="ticket-album__tab" type="button" onClick={onToggle}>
        <span>Album</span>
        <strong>{collectedSeatIds.size}/{PROGRAM_SCENES.length}</strong>
      </button>

      {isOpen && (
        <div className="ticket-album__book">
          <div className="ticket-album__header">
            <p>Birthday archive</p>
            <h2>Cinema Ticket Album</h2>
          </div>
          <div className="ticket-album__grid">
            {PROGRAM_SCENES.map((scene) => {
              const isCollected = collectedSeatIds.has(scene.seatId);

              return (
                <button
                  key={scene.seatId}
                  className={`ticket-sticker ${isCollected ? 'collected' : ''}`}
                  type="button"
                  disabled={!isCollected}
                  onClick={() => onOpenScene(scene.seatId)}
                >
                  <ClueLogo symbol={scene.symbol} palette={scene.palette} isCollected={isCollected} />
                  <span>
                    {isCollected
                      ? scene.title
                      : scene.isPlaceholder
                        ? 'Reserved'
                        : 'Locked scene'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

const VINYL_HINT_STORAGE_KEY = 'olliebd-cinema-vinyl-hint-dismissed';
const SOUNDTRACK_PLAYED_STORAGE_KEY = 'olliebd-cinema-soundtrack-played';

export function SoundtrackPanel({
  onSoundtrackEnded,
}: {
  onSoundtrackEnded?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOnRecord, setIsOnRecord] = useState(false);
  const [showHint, setShowHint] = useState(
    () => localStorage.getItem(VINYL_HINT_STORAGE_KEY) !== '1',
  );

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  function dismissHint() {
    if (!showHint) {
      return;
    }

    localStorage.setItem(VINYL_HINT_STORAGE_KEY, '1');
    setShowHint(false);
  }

  function handleVinylClick() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    dismissHint();

    if (isPlaying) {
      audio.pause();
      return;
    }

    unlockCinemaAudio().catch(() => undefined);
    if (!isOnRecord) {
      setIsOnRecord(true);
    }

    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }

  function handleEnded() {
    setIsPlaying(false);
    setIsOnRecord(false);
    localStorage.setItem(SOUNDTRACK_PLAYED_STORAGE_KEY, '1');
    onSoundtrackEnded?.();
  }

  return (
    <aside className="soundtrack-panel">
      {showHint && (
        <div className="soundtrack-hint" aria-live="polite">
          <span className="soundtrack-hint__text">tap here</span>
          <span className="soundtrack-hint__arrow" aria-hidden="true">→</span>
        </div>
      )}

      <div className={`soundtrack-record ${isPlaying ? 'is-playing-deck' : ''}`}>
        <div className="soundtrack-record__deck">
          <div className="soundtrack-record__platter-well" aria-hidden="true" />
          <div className="soundtrack-record__platter-mat" aria-hidden="true" />

          <button
            className="soundtrack-record__vinyl"
            type="button"
            aria-label={isPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
            onClick={handleVinylClick}
          >
            <span className={`soundtrack-record__disc ${isPlaying ? 'is-playing' : ''}`}>
              <span className="soundtrack-record__disc-label" aria-hidden="true">610</span>
              <span className="soundtrack-record__spindle" aria-hidden="true" />
            </span>
          </button>

          <div
            className={`soundtrack-record__tonearm ${isOnRecord ? 'is-engaged' : ''}`}
            aria-hidden="true"
          >
            <svg className="soundtrack-record__tonearm-svg" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id="tonearm-pivot" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f0dfb8" />
                  <stop offset="100%" stopColor="#6f5d45" />
                </linearGradient>
                <linearGradient id="tonearm-arm" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d8c39a" />
                  <stop offset="45%" stopColor="#f7ead0" />
                  <stop offset="100%" stopColor="#7a6750" />
                </linearGradient>
              </defs>
              <circle cx="84" cy="16" r="8.5" fill="url(#tonearm-pivot)" />
              <circle cx="84" cy="16" r="5.5" fill="#14110e" />
              <circle cx="84" cy="16" r="2.2" fill="#2a241c" />
              <circle cx="72" cy="24" r="5" fill="#3d342a" stroke="#5f5040" strokeWidth="1" />
              <path
                d="M84 16 C78 24 58 48 36 68"
                stroke="url(#tonearm-arm)"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              <rect x="27" y="63" width="16" height="11" rx="2.5" fill="#1a1714" transform="rotate(-32 35 68.5)" />
              <rect x="30" y="66" width="10" height="5" rx="1" fill="#2d2924" transform="rotate(-32 35 68.5)" />
              <path d="M31 74 L28 82" stroke="#efe2c0" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="28" cy="83" r="1.2" fill="#ffdf8b" className="soundtrack-record__stylus-tip" />
            </svg>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={SOUNDTRACK_AUDIO_SRC}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
        />
      </div>
    </aside>
  );
}
