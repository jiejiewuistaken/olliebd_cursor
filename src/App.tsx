import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html, OrbitControls, Text } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import * as THREE from 'three';

type MediaItem = {
  title: string;
  type: 'photo' | 'video';
  colorA: string;
  colorB: string;
  accent: string;
  src?: string;
};

type MediaManifestItem = {
  title: string;
  type: 'photo' | 'video';
  src: string;
};

const MEDIA_PALETTES = [
  { colorA: '#20d4ff', colorB: '#0a2b68', accent: '#fff0a8' },
  { colorA: '#ffc148', colorB: '#f25b3f', accent: '#43f6ff' },
  { colorA: '#1be7c9', colorB: '#12284f', accent: '#ffdf7e' },
  { colorA: '#ff7abf', colorB: '#421354', accent: '#8df5ff' },
  { colorA: '#5878ff', colorB: '#080b22', accent: '#ffb84d' },
];

const FALLBACK_MEDIA_ITEMS: MediaItem[] = [
  {
    title: 'Sky Ride',
    type: 'video',
    colorA: '#20d4ff',
    colorB: '#0a2b68',
    accent: '#fff0a8',
  },
  {
    title: 'Golden Hour',
    type: 'photo',
    colorA: '#ffc148',
    colorB: '#f25b3f',
    accent: '#43f6ff',
  },
  {
    title: 'Hidden Map',
    type: 'photo',
    colorA: '#1be7c9',
    colorB: '#12284f',
    accent: '#ffdf7e',
  },
  {
    title: 'Party Clip',
    type: 'video',
    colorA: '#ff7abf',
    colorB: '#421354',
    accent: '#8df5ff',
  },
  {
    title: 'Night Signal',
    type: 'video',
    colorA: '#5878ff',
    colorB: '#080b22',
    accent: '#ffb84d',
  },
];

const SEAT_LAYOUT = [7, 9, 10] as const;
const SEAT_SPACING = 1.08;
const ROW_DEPTH = 1.35;
const FIRST_ROW_Z = -1.95;

type SeatRef = {
  row: number;
  seat: number;
  seatId: string;
};

function seatCountForRow(rowNumber: number) {
  return SEAT_LAYOUT[rowNumber - 1] ?? SEAT_LAYOUT[0];
}

function seatPosition(rowNumber: number, seatNumber: number): [number, number, number] {
  const rowIndex = rowNumber - 1;
  const seatCount = seatCountForRow(rowNumber);
  const centeredSeatIndex = seatNumber - (seatCount + 1) / 2;

  return [centeredSeatIndex * SEAT_SPACING, rowIndex * 0.08, FIRST_ROW_Z + rowIndex * ROW_DEPTH];
}

type Viewpoint = {
  id: string;
  key: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  specialSeatId?: string;
};

function seatViewpoint(rowNumber: number, seatNumber: number): Viewpoint {
  const [x, , z] = seatPosition(rowNumber, seatNumber);
  const eyeHeight = 1.52 + (rowNumber - 1) * 0.1;
  const seatId = `${rowNumber}:${seatNumber}`;

  return {
    id: seatId,
    key: '',
    label: `Row ${rowNumber} Seat ${seatNumber}`,
    position: [x, eyeHeight, z + 0.54],
    target: [x * 0.12, 2.5, -7.45],
    specialSeatId: SPECIAL_SEATS.has(seatId) ? seatId : undefined,
  };
}

type Clue = {
  seatId: string;
  title: string;
  hint: string;
  symbol: string;
  palette: 'cyan' | 'gold';
};

const SPECIAL_SEATS = new Set(['1:3', '1:6', '2:5', '3:8']);
const GIFT_SEATS = SPECIAL_SEATS;
const SCREEN_TARGET: [number, number, number] = [0, 2.55, -7.45];

const SOUNDTRACK_TITLE = 'Birthday Cinema Soundtrack';

const CLUES: Clue[] = [
  {
    seatId: '1:3',
    title: 'Little Night Watcher',
    hint: 'A small shadow walks in circles until the room learns how to glow.',
    symbol: 'cat-orbit',
    palette: 'cyan',
  },
  {
    seatId: '1:6',
    title: 'Borderless Map',
    hint: 'A tiny continent waits under glass; the lens keeps searching for one warm route.',
    symbol: 'europe-lens',
    palette: 'gold',
  },
  {
    seatId: '2:5',
    title: 'Two Small Sticks',
    hint: 'Two thin lines meet and tap, like a rhythm saved for a table across the sea.',
    symbol: 'chopsticks',
    palette: 'cyan',
  },
  {
    seatId: '3:8',
    title: 'Mystery Reel',
    hint: 'This frame refuses to explain itself. Some birthday scenes should stay half-hidden.',
    symbol: 'mystery',
    palette: 'gold',
  },
];

function clueForSeat(seatId: string) {
  return CLUES.find((clue) => clue.seatId === seatId);
}

const INITIAL_VIEWPOINT: Viewpoint = {
  id: 'back-row',
  key: '1',
  label: 'Back row',
  // Start behind the seats so the room immediately reads as a cinema.
  position: [0, 2.12, 2.72],
  target: [0, 2.18, -5.8],
};

function createSeatRefs(): SeatRef[] {
  return SEAT_LAYOUT.flatMap((seatCount, rowIndex) =>
    Array.from({ length: seatCount }, (_, seatIndex) => ({
      row: rowIndex + 1,
      seat: seatIndex + 1,
      seatId: `${rowIndex + 1}:${seatIndex + 1}`,
    })),
  );
}

function useMediaItems() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(FALLBACK_MEDIA_ITEMS);

  useEffect(() => {
    let isMounted = true;

    fetch('/media-manifest.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : []))
      .then((manifest: MediaManifestItem[]) => {
        if (!isMounted || !Array.isArray(manifest) || manifest.length === 0) {
          return;
        }

        setMediaItems(
          manifest.map((item, index) => ({
            ...item,
            ...MEDIA_PALETTES[index % MEDIA_PALETTES.length],
          })),
        );
      })
      .catch(() => {
        if (isMounted) {
          setMediaItems(FALLBACK_MEDIA_ITEMS);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return mediaItems;
}

function App() {
  const seatRefs = useMemo(() => createSeatRefs(), []);
  const mediaItems = useMediaItems();
  const [activeViewpoint, setActiveViewpoint] = useState<Viewpoint>(INITIAL_VIEWPOINT);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [visibleClueSeatId, setVisibleClueSeatId] = useState<string | null>(null);
  const [collectedClueIds, setCollectedClueIds] = useState<string[]>([]);
  const [isAlbumOpen, setIsAlbumOpen] = useState(false);
  const clueImageSrc = useMemo(
    () =>
      mediaItems.find((item) => item.src?.toLowerCase().endsWith('.gif'))?.src ??
      mediaItems.find((item) => item.src && item.type === 'photo')?.src ??
      mediaItems.find((item) => item.src)?.src,
    [mediaItems],
  );
  const activeClue = visibleClueSeatId ? clueForSeat(visibleClueSeatId) : undefined;
  const collectedClueSet = useMemo(() => new Set(collectedClueIds), [collectedClueIds]);

  function revealClue(seatId: string) {
    setCollectedClueIds((currentIds) =>
      currentIds.includes(seatId) ? currentIds : [...currentIds, seatId],
    );
    setVisibleClueSeatId(seatId);
  }

  function selectSeat(seatRef: SeatRef) {
    const nextViewpoint = seatViewpoint(seatRef.row, seatRef.seat);
    setActiveViewpoint(nextViewpoint);
    setSelectedSeatId(seatRef.seatId);

    if (!nextViewpoint.specialSeatId) {
      setVisibleClueSeatId(null);
      return;
    }

    setCollectedClueIds((currentIds) =>
      currentIds.includes(nextViewpoint.specialSeatId!)
        ? currentIds
        : [...currentIds, nextViewpoint.specialSeatId!],
    );
    setVisibleClueSeatId((currentSeatId) =>
      currentSeatId === nextViewpoint.specialSeatId ? null : nextViewpoint.specialSeatId!,
    );
  }


  return (
    <main className="app-shell">
      <Canvas
        shadows
        camera={{ position: INITIAL_VIEWPOINT.position, fov: 58 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#07101b']} />
        <fog attach="fog" args={['#07101b', 10, 28]} />
        <Suspense fallback={null}>
          <CinemaScene activeViewpoint={activeViewpoint} />
          <EffectComposer>
            <Bloom
              intensity={0.65}
              luminanceThreshold={0.16}
              luminanceSmoothing={0.42}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      <section className="hud">
        <p className="eyebrow">React Three Fiber cinema</p>
        <h1>{selectedSeatId ? activeViewpoint.label : 'Choose a seat from the map.'}</h1>
        <p>Click any seat on the floating map to sit there, then drag freely to explore.</p>
      </section>

      <SeatMap
        seatRefs={seatRefs}
        selectedSeatId={selectedSeatId}
        collectedClueIds={collectedClueSet}
        onSelectSeat={selectSeat}
      />

      <SoundtrackRecord title={SOUNDTRACK_TITLE} />

      <CinemaTicketAlbum
        clues={CLUES}
        collectedClueIds={collectedClueSet}
        isOpen={isAlbumOpen}
        onToggle={() => setIsAlbumOpen((isOpen) => !isOpen)}
        onOpenClue={revealClue}
      />


      {activeClue && (
        <MysteryClueOverlay
          clue={activeClue}
          imageSrc={clueImageSrc}
          onClose={() => setVisibleClueSeatId(null)}
        />
      )}
      <div className="vignette" />
    </main>
  );
}

function SeatMap({
  seatRefs,
  selectedSeatId,
  collectedClueIds,
  onSelectSeat,
}: {
  seatRefs: SeatRef[];
  selectedSeatId: string | null;
  collectedClueIds: Set<string>;
  onSelectSeat: (seatRef: SeatRef) => void;
}) {
  return (
    <section className="seat-map" aria-label="Cinema seat map">
      <div className="seat-map__screen">Screen</div>
      <div className="seat-map__rows">
        {SEAT_LAYOUT.map((seatCount, rowIndex) => {
          const rowNumber = rowIndex + 1;
          const rowSeats = seatRefs.filter((seatRef) => seatRef.row === rowNumber);

          return (
            <div key={rowNumber} className="seat-map__row" style={{ '--seat-count': seatCount } as CSSProperties}>
              <span className="seat-map__row-label">R{rowNumber}</span>
              <div className="seat-map__seats">
                {rowSeats.map((seatRef) => {
                  const isSelected = selectedSeatId === seatRef.seatId;
                  const isCollected = collectedClueIds.has(seatRef.seatId);

                  return (
                    <button
                      key={seatRef.seatId}
                      className={`seat-map__seat ${isSelected ? 'selected' : ''} ${isCollected ? 'collected' : ''}`}
                      type="button"
                      aria-label={`Row ${seatRef.row} Seat ${seatRef.seat}`}
                      onClick={() => onSelectSeat(seatRef)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SoundtrackRecord({ title }: { title: string }) {
  return (
    <button className="soundtrack-record" type="button" aria-label={title}>
      <span className="soundtrack-record__disc" />
      <span className="soundtrack-record__label">{title}</span>
    </button>
  );
}

function ClueLogo({ clue, isCollected }: { clue: Clue; isCollected: boolean }) {
  return (
    <span className={
      `clue-logo clue-logo--${clue.symbol} clue-logo--${clue.palette} ${isCollected ? 'collected' : ''}`
    }>
      {clue.symbol === 'cat-orbit' ? <CatOrbitSketch /> : <span />}
    </span>
  );
}

function CatOrbitSketch() {
  return (
    <svg className="cat-orbit-sketch" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="cat-orbit-sketch__circle" cx="50" cy="50" r="34" />
      <circle className="cat-orbit-sketch__circle cat-orbit-sketch__circle--draft" cx="50" cy="50" r="38" />
      <g className="cat-orbit-sketch__cat">
        <ellipse cx="50" cy="18" rx="10" ry="7" />
        <circle cx="39" cy="15" r="6" />
        <path d="M35 11 L37 4 L41 11" />
        <path d="M42 11 L46 5 L47 14" />
        <path d="M58 18 C68 13 70 25 62 27" />
        <path d="M44 20 L42 27" />
        <path d="M53 21 L55 28" />
        <circle cx="37.5" cy="15" r="1" />
        <circle cx="41.5" cy="15" r="1" />
      </g>
    </svg>
  );
}

function CinemaTicketAlbum({
  clues,
  collectedClueIds,
  isOpen,
  onToggle,
  onOpenClue,
}: {
  clues: Clue[];
  collectedClueIds: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
  onOpenClue: (seatId: string) => void;
}) {
  return (
    <aside className={`ticket-album ${isOpen ? 'open' : ''}`}>
      <button className="ticket-album__tab" type="button" onClick={onToggle}>
        <span>Album</span>
        <strong>{collectedClueIds.size}/{clues.length}</strong>
      </button>

      {isOpen && (
        <div className="ticket-album__book">
          <div className="ticket-album__header">
            <p>Birthday archive</p>
            <h2>Cinema Ticket Album</h2>
          </div>
          <div className="ticket-album__grid">
            {clues.map((clue) => {
              const isCollected = collectedClueIds.has(clue.seatId);

              return (
                <button
                  key={clue.seatId}
                  className={`ticket-sticker ${isCollected ? 'collected' : 'locked'}`}
                  type="button"
                  disabled={!isCollected}
                  onClick={() => onOpenClue(clue.seatId)}
                >
                  <ClueLogo clue={clue} isCollected={isCollected} />
                  <span>{isCollected ? clue.title : 'Locked scene'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function MysteryClueOverlay({
  clue,
  imageSrc,
  onClose,
}: {
  clue: Clue;
  imageSrc?: string;
  onClose: () => void;
}) {
  const [row, seat] = clue.seatId.split(':');

  return (
    <section className="mystery-card-overlay" aria-live="polite" onClick={onClose}>
      <article
        className={`mystery-card mystery-card--${clue.palette}`}
        onClick={(event) => event.stopPropagation()}
      >
      <div className="mystery-card__sprockets" aria-hidden="true" />
      <div className="mystery-card__content">
        <p className="mystery-card__eyebrow">Found frame</p>
        <ClueLogo clue={clue} isCollected />
        <h2>{clue.title}</h2>
        <p className="mystery-card__seat">Row {row} Seat {seat}</p>
        <div className="mystery-card__image">
          {imageSrc ? <img src={encodeURI(imageSrc)} alt="Mystery clue" /> : <span>?</span>}
        </div>
        <p>{clue.hint}</p>
      </div>
      <div className="mystery-card__sprockets" aria-hidden="true" />
      </article>
    </section>
  );
}

function CinemaScene({ activeViewpoint }: { activeViewpoint: Viewpoint }) {
  const controls = useRef<any>(null);

  return (
    <>
      <ambientLight intensity={0.08} />
      <ProjectorLightRig />
      <CinemaRoom />
      <FloatingScreen />
      <SeatRows />
      <WaypointCameraController activeViewpoint={activeViewpoint} controlsRef={controls} />
      <OrbitControls
        ref={controls}
        enableDamping
        dampingFactor={0.06}
        minDistance={1.2}
        maxDistance={11}
        maxPolarAngle={Math.PI * 0.58}
        target={INITIAL_VIEWPOINT.target}
      />
    </>
  );
}

function WaypointCameraController({
  activeViewpoint,
  controlsRef,
}: {
  activeViewpoint: Viewpoint;
  controlsRef: MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const isTransitioning = useRef(false);
  const targetPosition = useMemo(
    () => new THREE.Vector3(...activeViewpoint.position),
    [activeViewpoint.position],
  );
  const targetLookAt = useMemo(
    () => new THREE.Vector3(...activeViewpoint.target),
    [activeViewpoint.target],
  );

  useEffect(() => {
    isTransitioning.current = true;
  }, [activeViewpoint.id]);

  useFrame((_, delta) => {
    if (!isTransitioning.current) {
      return;
    }

    const smoothing = 1 - Math.exp(-delta * 3.4);
    camera.position.lerp(targetPosition, smoothing);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt, smoothing);
      controlsRef.current.update();
    }

    const targetDistance = controlsRef.current
      ? controlsRef.current.target.distanceTo(targetLookAt)
      : 0;

    if (camera.position.distanceTo(targetPosition) < 0.035 && targetDistance < 0.035) {
      camera.position.copy(targetPosition);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLookAt);
        controlsRef.current.update();
      }
      isTransitioning.current = false;
    }
  });

  return null;
}

function ProjectorLightRig() {
  return (
    <group>
      <spotLight
        color="#fff2c0"
        intensity={260}
        position={[0, 4.3, 5.2]}
        angle={0.34}
        penumbra={0.8}
        distance={16}
        castShadow
      />
      <pointLight color="#ff9f31" intensity={42} position={[5.6, 2.8, -6.8]} distance={8} />
      <pointLight color="#2bffff" intensity={35} position={[-4.8, 2.6, -6.8]} distance={8} />
      <ProjectorBeams />
      <mesh position={[0, 4.15, 5.45]} castShadow>
        <boxGeometry args={[1.1, 0.38, 0.8]} />
        <meshStandardMaterial color="#11131a" metalness={0.25} roughness={0.38} />
      </mesh>
      <mesh position={[0, 4.1, 4.95]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.35, 32]} />
        <meshStandardMaterial color="#252b36" emissive="#ffe9ae" emissiveIntensity={0.65} />
      </mesh>
    </group>
  );
}

function ProjectorBeams() {
  const warmBeam = useRef<THREE.Mesh>(null);
  const cyanBeam = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.elapsedTime * 1.8) * 0.035;
    if (warmBeam.current) {
      warmBeam.current.scale.setScalar(1 + pulse);
    }
    if (cyanBeam.current) {
      cyanBeam.current.scale.setScalar(0.92 - pulse);
    }
  });

  return (
    <group position={[0, 3.05, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={warmBeam} position={[0, 0, 0]} renderOrder={1}>
        <coneGeometry args={[3.4, 10.8, 64, 1, true]} />
        <meshBasicMaterial
          color="#ffb34f"
          transparent
          opacity={0.11}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={cyanBeam} position={[-0.5, 0.08, 0.1]} renderOrder={2}>
        <coneGeometry args={[2.2, 10.5, 64, 1, true]} />
        <meshBasicMaterial
          color="#32e9ff"
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function CinemaRoom() {
  return (
    <group>
      <OpenAirSky />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[18, 24]} />
        <meshStandardMaterial color="#090b0a" roughness={0.86} metalness={0.04} />
      </mesh>
      <mesh position={[0, 1.45, -8.85]} receiveShadow>
        <boxGeometry args={[17, 2.9, 0.22]} />
        <meshStandardMaterial color="#08080a" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.32, 3.9]} receiveShadow>
        <boxGeometry args={[12, 0.64, 0.18]} />
        <meshStandardMaterial color="#120b07" roughness={0.84} />
      </mesh>
      <FestivalStringLights />
      <PalmSilhouettes />
      <AisleLights />
    </group>
  );
}

function OpenAirSky() {
  return (
    <group>
      <mesh position={[0, 7.5, -7]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[18, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#07101b" side={THREE.BackSide} />
      </mesh>
      <mesh position={[-5.6, 5.5, -9.8]}>
        <circleGeometry args={[0.42, 32]} />
        <meshBasicMaterial color="#fff1c8" transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function FestivalStringLights() {
  const bulbs = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        x: -6.6 + index * 1.2,
        y: 3.95 + Math.sin(index * 0.8) * 0.18,
        z: 1.6 - index * 0.36,
      })),
    [],
  );

  return (
    <group>
      {bulbs.map((bulb, index) => (
        <group key={index} position={[bulb.x, bulb.y, bulb.z]}>
          <pointLight color={index % 2 ? '#ffd082' : '#8df5ff'} intensity={2.4} distance={2.6} />
          <mesh>
            <sphereGeometry args={[0.055, 12, 8]} />
            <meshStandardMaterial
              color={index % 2 ? '#ffd082' : '#8df5ff'}
              emissive={index % 2 ? '#ffd082' : '#8df5ff'}
              emissiveIntensity={1.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PalmSilhouettes() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 7.1, 0.35, -7.2]} rotation={[0, side * -0.22, 0]}>
          <mesh position={[0, 1.1, 0]} rotation={[0, 0, side * 0.08]}>
            <cylinderGeometry args={[0.08, 0.14, 2.2, 8]} />
            <meshStandardMaterial color="#030405" roughness={0.9} />
          </mesh>
          {[-0.8, -0.4, 0, 0.4, 0.8].map((angle) => (
            <mesh key={angle} position={[0, 2.25, 0]} rotation={[0.35, angle, side * 0.5]}>
              <coneGeometry args={[0.18, 1.45, 4]} />
              <meshStandardMaterial color="#030405" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function AisleLights() {
  const lights = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        z: -4.8 + index * 1.25,
        side: index % 2 === 0 ? -1 : 1,
      })),
    [],
  );

  return (
    <group>
      {lights.map((light, index) => (
        <mesh
          key={index}
          position={[light.side * 7.88, 0.08, light.z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.035, 0.035, 0.5, 16]} />
          <meshStandardMaterial
            color="#ff9f2d"
            emissive="#ff9f2d"
            emissiveIntensity={1.1}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function FloatingScreen() {
  return (
    <Float speed={1.2} rotationIntensity={0.035} floatIntensity={0.16}>
      <group position={[0, 2.72, -7.45]} rotation={[0.02, 0, 0]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[6.45, 2.75]} />
          <meshStandardMaterial
            color="#07131b"
            emissive="#2ef3ff"
            emissiveIntensity={0.18}
            roughness={0.18}
          />
        </mesh>
        <Text
          position={[0, 0.02, -0.08]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.42}
          color="#ffdf8b"
          anchorX="center"
          anchorY="middle"
          outlineColor="#080405"
          outlineWidth={0.018}
        >
          Happy Birthday Ollie
        </Text>
        <ScreenGlow />
        <RollingMediaStrip />
        <mesh position={[0, 0, 0.08]}>
          <ringGeometry args={[3.55, 3.7, 4]} />
          <meshBasicMaterial
            color="#ffb34a"
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </Float>
  );
}

function ScreenGlow() {
  const glow = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (glow.current) {
      glow.current.scale.set(
        1 + Math.sin(clock.elapsedTime * 1.4) * 0.018,
        1 + Math.cos(clock.elapsedTime * 1.1) * 0.02,
        1,
      );
    }
  });

  return (
    <mesh ref={glow} position={[0, 0, 0.11]} renderOrder={4}>
      <planeGeometry args={[7.5, 3.8]} />
      <meshBasicMaterial
        color="#ffc15c"
        transparent
        opacity={0.13}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function RollingMediaStrip() {
  const mediaItems = useMediaItems();

  return (
    <group position={[0, 0, 0.16]}>
      {mediaItems.map((item, index) => (
        <RollingMediaPanel
          key={item.src ?? item.title}
          item={item}
          index={index}
          itemCount={mediaItems.length}
        />
      ))}
      <mesh position={[-3.45, 0, 0.06]}>
        <boxGeometry args={[0.34, 2.86, 0.08]} />
        <meshBasicMaterial color="#07080b" transparent opacity={0.9} />
      </mesh>
      <mesh position={[3.45, 0, 0.06]}>
        <boxGeometry args={[0.34, 2.86, 0.08]} />
        <meshBasicMaterial color="#07080b" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function useMediaTexture(item: MediaItem) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!item.src) {
      setTexture(null);
      return;
    }

    let isDisposed = false;
    setTexture(null);

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = item.src;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;

      setTexture(videoTexture);
      video.play().catch(() => undefined);

      return () => {
        isDisposed = true;
        video.pause();
        video.removeAttribute('src');
        video.load();
        videoTexture.dispose();
      };
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    let imageTexture: THREE.Texture | null = null;

    image.onload = () => {
      if (isDisposed) {
        return;
      }

      const maxTextureSize = 2048;
      const scale = Math.min(1, maxTextureSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');

      if (!context) {
        setTexture(null);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      imageTexture = new THREE.CanvasTexture(canvas);
      imageTexture.colorSpace = THREE.SRGBColorSpace;
      imageTexture.minFilter = THREE.LinearFilter;
      imageTexture.magFilter = THREE.LinearFilter;
      imageTexture.needsUpdate = true;
      setTexture(imageTexture);
    };

    image.onerror = () => {
      if (!isDisposed) {
        setTexture(null);
      }
    };

    image.src = encodeURI(item.src);

    return () => {
      isDisposed = true;
      imageTexture?.dispose();
      image.onload = null;
      image.onerror = null;
    };
  }, [item.src, item.type]);

  return texture;
}

function RollingMediaPanel({
  item,
  index,
  itemCount,
}: {
  item: MediaItem;
  index: number;
  itemCount: number;
}) {
  const group = useRef<THREE.Group>(null);
  const mediaTexture = useMediaTexture(item);
  const hasMedia = Boolean(item.src);
  const accent = new THREE.Color(item.accent);
  const base = new THREE.Color(item.colorA);
  const dark = new THREE.Color(item.colorB);
  const blendedAccent = useMemo(
    () => new THREE.Color(item.colorB).lerp(new THREE.Color(item.accent), 0.3),
    [item.accent, item.colorB],
  );

  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }

    const spacing = 2.28;
    const cycle = itemCount * spacing;
    const raw = index * spacing - clock.elapsedTime * 0.84 + cycle * 2;
    const x = ((raw % cycle) + cycle) % cycle - cycle / 2;
    const lift = Math.sin(clock.elapsedTime * 1.1 + index) * 0.035;

    group.current.position.set(x, lift, 0);
    group.current.rotation.y = x * -0.035;
    group.current.scale.setScalar(1 - Math.min(Math.abs(x) * 0.035, 0.17));
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[2.0, 1.22, 0.06]} />
        <meshStandardMaterial color={dark} emissive={base} emissiveIntensity={0.22} roughness={0.2} />
      </mesh>
      <FilmFrameTreatment
        accent={item.accent}
        base={item.colorA}
        dark={item.colorB}
        hasMedia={hasMedia}
      />
      <mesh position={[0, 0.08, 0.07]}>
        <planeGeometry args={[1.68, 0.9]} />
        <meshBasicMaterial
          color={mediaTexture ? '#ffffff' : base}
          map={mediaTexture ?? undefined}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.34, -0.06, 0.09]} rotation={[0, 0, -0.26]}>
        <planeGeometry args={[0.92, 0.62]} />
        <meshBasicMaterial
          color={blendedAccent}
          transparent
          opacity={hasMedia ? 0.06 : 0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.5, -0.18, 0.1]} rotation={[0, 0, 0.3]}>
        <planeGeometry args={[0.84, 0.48]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={hasMedia ? 0.08 : 0.52}
          depthWrite={false}
        />
      </mesh>
      {item.type === 'video' ? (
        <>
          <mesh position={[0, 0.09, 0.09]} rotation={[0, 0, -Math.PI / 2]}>
            <circleGeometry args={[0.22, 3]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.86} />
          </mesh>
          <MovingScanLines color={item.accent} />
        </>
      ) : (
        <PhotoSparkles color={item.accent} />
      )}
    </group>
  );
}

function FilmFrameTreatment({
  accent,
  base,
  dark,
  hasMedia,
}: {
  accent: string;
  base: string;
  dark: string;
  hasMedia: boolean;
}) {
  const sprocketHoles = useMemo(() => [-0.36, -0.18, 0, 0.18, 0.36], []);
  const glowOpacity = hasMedia ? 0.2 : 0.34;

  return (
    <group position={[0, 0.08, 0.08]}>
      <mesh position={[0, 0.5, 0]}>
        <planeGeometry args={[1.86, 0.1]} />
        <meshBasicMaterial color={base} transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <planeGeometry args={[1.86, 0.1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.82} />
      </mesh>
      <mesh position={[-0.9, 0, 0]}>
        <planeGeometry args={[0.12, 1.08]} />
        <meshBasicMaterial color={dark} transparent opacity={0.94} />
      </mesh>
      <mesh position={[0.9, 0, 0]}>
        <planeGeometry args={[0.12, 1.08]} />
        <meshBasicMaterial color={dark} transparent opacity={0.94} />
      </mesh>
      {sprocketHoles.map((y) => (
        <group key={y}>
          <mesh position={[-0.9, y, 0.01]}>
            <planeGeometry args={[0.058, 0.072]} />
            <meshBasicMaterial color="#040407" transparent opacity={0.96} />
          </mesh>
          <mesh position={[0.9, y, 0.01]}>
            <planeGeometry args={[0.058, 0.072]} />
            <meshBasicMaterial color="#040407" transparent opacity={0.96} />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.5, 0.34, 0.02]} rotation={[0, 0, -0.22]}>
        <planeGeometry args={[0.78, 0.08]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={hasMedia ? 0.16 : 0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.46, -0.36, 0.02]} rotation={[0, 0, -0.2]}>
        <planeGeometry args={[0.88, 0.16]} />
        <meshBasicMaterial color={accent} transparent opacity={glowOpacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MovingScanLines({ color }: { color: string }) {
  const lineOne = useRef<THREE.Mesh>(null);
  const lineTwo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lineOne.current) {
      lineOne.current.position.y = -0.28 + ((t * 0.32) % 0.56);
    }
    if (lineTwo.current) {
      lineTwo.current.position.y = -0.3 + (((t * 0.24) + 0.22) % 0.6);
    }
  });

  return (
    <>
      <mesh ref={lineOne} position={[0, 0, 0.1]}>
        <planeGeometry args={[1.54, 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} />
      </mesh>
      <mesh ref={lineTwo} position={[0, 0.2, 0.1]}>
        <planeGeometry args={[1.2, 0.014]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
      </mesh>
    </>
  );
}

function PhotoSparkles({ color }: { color: string }) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        x: -0.68 + ((index * 0.31) % 1.32),
        y: -0.2 + ((index * 0.19) % 0.66),
        scale: 0.025 + (index % 3) * 0.012,
      })),
    [],
  );

  return (
    <group>
      {sparkles.map((sparkle, index) => (
        <mesh key={index} position={[sparkle.x, sparkle.y, 0.1]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[sparkle.scale, sparkle.scale, 0.008]} />
          <meshBasicMaterial color={index % 2 ? '#ffffff' : color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function SeatRows() {
  const rows = useMemo(
    () =>
      SEAT_LAYOUT.map((seatCount, rowIndex) => ({
        row: rowIndex + 1,
        seats: Array.from({ length: seatCount }, (_, seatIndex) => seatIndex + 1),
      })),
    [],
  );

  return (
    <group>
      {rows.map(({ row, seats }) => (
        <group key={row}>
          {seats.map((seat) => {
            const seatId = `${row}:${seat}`;

            return (
              <CinemaChair
                key={seatId}
                position={seatPosition(row, seat)}
                hasGift={GIFT_SEATS.has(seatId)}
                label={`Row ${row} Seat ${seat}`}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

function CinemaChair({
  position,
  hasGift,
  label,
}: {
  position: [number, number, number];
  hasGift: boolean;
  label: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.18, 0.82]} />
        <meshStandardMaterial color="#281013" roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.94, 0.37]} rotation={[0.13, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.98, 0.88, 0.18]} />
        <meshStandardMaterial color="#3a1219" roughness={0.65} />
      </mesh>
      <mesh position={[-0.58, 0.66, 0.03]} castShadow>
        <boxGeometry args={[0.16, 0.34, 0.86]} />
        <meshStandardMaterial color="#1c0b0e" roughness={0.72} />
      </mesh>
      <mesh position={[0.58, 0.66, 0.03]} castShadow>
        <boxGeometry args={[0.16, 0.34, 0.86]} />
        <meshStandardMaterial color="#1c0b0e" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.93, 0.48]} castShadow>
        <boxGeometry args={[0.58, 0.12, 0.06]} />
        <meshStandardMaterial color="#6b2230" emissive="#24050a" emissiveIntensity={0.3} />
      </mesh>
      {hasGift && <GiftHint label={label} />}
    </group>
  );
}

function GiftHint({ label }: { label: string }) {
  const gift = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (gift.current) {
      gift.current.rotation.y = Math.sin(clock.elapsedTime * 1.7) * 0.16;
      gift.current.position.y = 0.76 + Math.sin(clock.elapsedTime * 2.4) * 0.025;
    }
  });

  return (
    <group ref={gift} position={[0, 0.76, -0.08]}>
      <pointLight color="#ffcf68" intensity={7} distance={1.5} />
      <mesh castShadow>
        <boxGeometry args={[0.28, 0.24, 0.28]} />
        <meshStandardMaterial
          color="#ffb12f"
          emissive="#ff8c1a"
          emissiveIntensity={0.38}
          roughness={0.34}
        />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.04, 0.27, 0.31]} />
        <meshStandardMaterial color="#fff2c7" emissive="#fff2c7" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.31, 0.27, 0.04]} />
        <meshStandardMaterial color="#fff2c7" emissive="#fff2c7" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <torusGeometry args={[0.09, 0.014, 8, 20]} />
        <meshStandardMaterial color="#fff2c7" emissive="#fff2c7" emissiveIntensity={0.45} />
      </mesh>
      <Html position={[0, 0.38, 0]} center distanceFactor={5.5} className="gift-label">
        {label}
      </Html>
    </group>
  );
}

export default App;
