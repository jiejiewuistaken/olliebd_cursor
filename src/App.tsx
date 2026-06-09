import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html, OrbitControls, Text } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  PROGRAM_SCENES,
  resolveShowAct,
  sceneForSeat,
  stillCaptionForSrc,
  type ShowAct,
} from './cinemaProgram';
import { startProjectorHum, stopProjectorHum } from './cinemaAudio';
import {
  FestivalSceneCard,
  SceneAlbumPanel,
  PreShowOverlay,
  ProgramHud,
  SoundtrackPanel,
} from './cinemaUi';

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
    specialSeatId: clueForSeat(seatId) ? seatId : undefined,
  };
}

type Clue = (typeof PROGRAM_SCENES)[number];

const GIFT_SEATS = new Set(PROGRAM_SCENES.map((scene) => scene.seatId));
const SCREEN_TARGET: [number, number, number] = [0, 2.55, -7.45];

const CLUES: Clue[] = PROGRAM_SCENES;

function clueForSeat(seatId: string) {
  return sceneForSeat(seatId);
}

const LOBBY_VIEWPOINT: Viewpoint = {
  id: 'lobby',
  key: '0',
  label: 'Lobby entrance',
  position: [0, 2.38, 5.35],
  target: [0, 2.35, -3.5],
};

const INITIAL_VIEWPOINT = LOBBY_VIEWPOINT;

function createSeatRefs(): SeatRef[] {
  return SEAT_LAYOUT.flatMap((seatCount, rowIndex) =>
    Array.from({ length: seatCount }, (_, seatIndex) => ({
      row: rowIndex + 1,
      seat: seatIndex + 1,
      seatId: `${rowIndex + 1}:${seatIndex + 1}`,
    })),
  );
}

function shouldIncludeInRollingStrip(item: MediaManifestItem) {
  return !/\/image\.(png|svg)$/i.test(item.src);
}

const ROLLING_PHOTO_WIDTH = 1680;
const ROLLING_PHOTO_HEIGHT = 900;
const rollingPhotoTextureCache = new Map<string, THREE.Texture>();
const rollingPhotoTextureLoads = new Map<string, Promise<THREE.Texture | null>>();

function drawMediaCoverCanvas(image: CanvasImageSource) {
  const sourceWidth = 'naturalWidth' in image ? image.naturalWidth : ROLLING_PHOTO_WIDTH;
  const sourceHeight = 'naturalHeight' in image ? image.naturalHeight : ROLLING_PHOTO_HEIGHT;
  const targetAspect = ROLLING_PHOTO_WIDTH / ROLLING_PHOTO_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = ROLLING_PHOTO_WIDTH;
  canvas.height = ROLLING_PHOTO_HEIGHT;
  const context = canvas.getContext('2d');

  if (!context || sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  context.fillStyle = '#0b1118';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const sourceAspect = sourceWidth / sourceHeight;
  let cropX = 0;
  let cropY = 0;
  let cropW = sourceWidth;
  let cropH = sourceHeight;

  if (sourceAspect > targetAspect) {
    cropW = sourceHeight * targetAspect;
    cropX = (sourceWidth - cropW) / 2;
  } else {
    cropH = sourceWidth / targetAspect;
    cropY = (sourceHeight - cropH) / 2;
  }

  context.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadRollingPhotoTexture(src: string) {
  const cached = rollingPhotoTextureCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = rollingPhotoTextureLoads.get(src);
  if (pending) {
    return pending;
  }

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      encodeURI(src),
      (loadedTexture) => {
        const image = loadedTexture.image as HTMLImageElement;
        const canvas = drawMediaCoverCanvas(image);
        loadedTexture.dispose();

        if (!canvas) {
          resolve(null);
          return;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        rollingPhotoTextureCache.set(src, texture);
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  }).finally(() => {
    rollingPhotoTextureLoads.delete(src);
  });

  rollingPhotoTextureLoads.set(src, promise);
  return promise;
}

function RollingPhotoSurface({ src, dark }: { src: string; dark: string }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(
    () => rollingPhotoTextureCache.get(src) ?? null,
  );

  useEffect(() => {
    let isMounted = true;

    if (rollingPhotoTextureCache.has(src)) {
      setTexture(rollingPhotoTextureCache.get(src) ?? null);
      return;
    }

    loadRollingPhotoTexture(src).then((loadedTexture) => {
      if (isMounted) {
        setTexture(loadedTexture);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src]);

  return (
    <mesh position={[0, 0.08, 0.07]}>
      <planeGeometry args={[1.68, 0.9]} />
      {texture ? (
        <meshBasicMaterial key={texture.uuid} map={texture} color="#ffffff" />
      ) : (
        <meshBasicMaterial color={dark} />
      )}
    </mesh>
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
          manifest
            .filter(shouldIncludeInRollingStrip)
            .map((item, index) => ({
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
  const [preShowComplete, setPreShowComplete] = useState(false);
  const [activeViewpoint, setActiveViewpoint] = useState<Viewpoint>(LOBBY_VIEWPOINT);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [visibleClueSeatId, setVisibleClueSeatId] = useState<string | null>(null);
  const [collectedClueIds, setCollectedClueIds] = useState<string[]>([]);
  const [isAlbumOpen, setIsAlbumOpen] = useState(false);
  const [backstageVisited, setBackstageVisited] = useState(false);
  const [houseLightsBright, setHouseLightsBright] = useState(
    () => localStorage.getItem('olliebd-cinema-soundtrack-played') === '1',
  );
  const activeScene = visibleClueSeatId ? sceneForSeat(visibleClueSeatId) : undefined;
  const collectedClueSet = useMemo(() => new Set(collectedClueIds), [collectedClueIds]);
  const showAct = resolveShowAct({
    preShowComplete,
    collectedCount: collectedClueIds.length,
    backstageVisited,
    enteredAuditorium: Boolean(selectedSeatId),
  });

  const handlePreShowComplete = useCallback(() => {
    setPreShowComplete(true);
    setHouseLightsBright(localStorage.getItem('olliebd-cinema-soundtrack-played') === '1');
    setActiveViewpoint(LOBBY_VIEWPOINT);
  }, []);

  const handleSoundtrackEnded = useCallback(() => {
    setHouseLightsBright(true);
  }, []);

  const handleBackstageEnter = useCallback(() => {
    setBackstageVisited(true);
  }, []);

  useEffect(() => {
    if (preShowComplete) {
      startProjectorHum();
      return () => stopProjectorHum();
    }

    return undefined;
  }, [preShowComplete]);

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
    <main className={`app-shell ${houseLightsBright ? 'app-shell--house-bright' : 'app-shell--house-dim'}`}>
      <Canvas
        shadows
        camera={{ position: LOBBY_VIEWPOINT.position, fov: 58 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[houseLightsBright ? '#07101b' : '#010102']} />
        <fog attach="fog" args={[houseLightsBright ? '#07101b' : '#010102', houseLightsBright ? 10 : 4, houseLightsBright ? 28 : 11]} />
        <Suspense fallback={null}>
          <CinemaScene
            activeViewpoint={activeViewpoint}
            showAct={showAct}
            curtainOpen={preShowComplete}
            collectedClueIds={collectedClueIds}
            uiOverlayOpen={Boolean(visibleClueSeatId) || isAlbumOpen}
            houseLightsBright={houseLightsBright}
            onBackstageEnter={handleBackstageEnter}
          />
          <EffectComposer>
            <Bloom
              intensity={houseLightsBright ? 0.65 : 0.06}
              luminanceThreshold={0.16}
              luminanceSmoothing={0.42}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {!preShowComplete && <PreShowOverlay onComplete={handlePreShowComplete} />}

      {preShowComplete && (
        <>
          <ProgramHud
            act={showAct}
            selectedSeatLabel={selectedSeatId ? activeViewpoint.label : null}
            collectedCount={collectedClueIds.length}
            totalScenes={PROGRAM_SCENES.length}
          />

          <SeatMap
            seatRefs={seatRefs}
            selectedSeatId={selectedSeatId}
            collectedClueIds={collectedClueSet}
            onSelectSeat={selectSeat}
          />

          <SoundtrackPanel onSoundtrackEnded={handleSoundtrackEnded} />

          <SceneAlbumPanel
            collectedSeatIds={collectedClueSet}
            isOpen={isAlbumOpen}
            onToggle={() => setIsAlbumOpen((isOpen) => !isOpen)}
            onOpenScene={revealClue}
          />
        </>
      )}

      {activeScene && (
        <FestivalSceneCard
          scene={activeScene}
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

function CinemaScene({
  activeViewpoint,
  showAct,
  curtainOpen,
  collectedClueIds,
  uiOverlayOpen,
  houseLightsBright,
  onBackstageEnter,
}: {
  activeViewpoint: Viewpoint;
  showAct: ShowAct;
  curtainOpen: boolean;
  collectedClueIds: string[];
  uiOverlayOpen: boolean;
  houseLightsBright: boolean;
  onBackstageEnter: () => void;
}) {
  const controls = useRef<any>(null);
  const isTransitioning = useRef(false);

  useEffect(() => {
    if (!controls.current) {
      return;
    }

    controls.current.target.set(...INITIAL_VIEWPOINT.target);
    controls.current.update();
  }, []);

  return (
    <>
      <SceneLighting showAct={showAct} houseLightsBright={houseLightsBright} />
      <ProjectorLightRig showAct={showAct} houseLightsBright={houseLightsBright} />
      <CinemaRoom houseLightsBright={houseLightsBright} />
      <FloatingScreen
        curtainOpen={curtainOpen}
        showCaptions={!uiOverlayOpen}
        houseLightsBright={houseLightsBright}
      />
      <SeatRows showAct={showAct} collectedClueIds={collectedClueIds} uiOverlayOpen={uiOverlayOpen} />
      <BackstageDetector onEnter={onBackstageEnter} />
      <WaypointCameraController
        activeViewpoint={activeViewpoint}
        controlsRef={controls}
        isTransitioningRef={isTransitioning}
      />
      <OrbitControls
        ref={controls}
        enableDamping
        dampingFactor={0.06}
        minDistance={1.2}
        maxDistance={11}
        maxPolarAngle={Math.PI * 0.58}
        onStart={() => {
          isTransitioning.current = false;
        }}
      />
    </>
  );
}

function SceneLighting({
  showAct,
  houseLightsBright,
}: {
  showAct: ShowAct;
  houseLightsBright: boolean;
}) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const houseLeft = useRef<THREE.PointLight>(null);
  const houseRight = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const actAmbient =
      showAct === 'preshow' ? 0.03 :
      showAct === 'lobby' ? 0.06 :
      0.085;
    const actHouse =
      showAct === 'lobby' ? 8 :
      11;
    const targetAmbient = houseLightsBright ? actAmbient : actAmbient * 0.03;
    const targetHouse = houseLightsBright ? actHouse : actHouse * 0.04;
    const smoothing = 1 - Math.exp(-delta * 2.4);

    if (ambient.current) {
      ambient.current.intensity = THREE.MathUtils.lerp(ambient.current.intensity, targetAmbient, smoothing);
    }

    if (houseLeft.current && houseRight.current) {
      houseLeft.current.intensity = THREE.MathUtils.lerp(houseLeft.current.intensity, targetHouse, smoothing);
      houseRight.current.intensity = THREE.MathUtils.lerp(houseRight.current.intensity, targetHouse, smoothing);
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.03} />
      <pointLight ref={houseLeft} color="#ffd7a0" intensity={8} position={[-6.2, 3.2, 2.4]} distance={14} />
      <pointLight ref={houseRight} color="#ffd7a0" intensity={8} position={[6.2, 3.2, 2.4]} distance={14} />
    </>
  );
}

function BackstageDetector({ onEnter }: { onEnter: () => void }) {
  const { camera } = useThree();
  const entered = useRef(false);

  useFrame(() => {
    if (entered.current) {
      return;
    }

    if (camera.position.z < -7.1 && camera.position.y > 1.1 && camera.position.y < 4.3) {
      entered.current = true;
      onEnter();
    }
  });

  return null;
}

function WaypointCameraController({
  activeViewpoint,
  controlsRef,
  isTransitioningRef,
}: {
  activeViewpoint: Viewpoint;
  controlsRef: MutableRefObject<any>;
  isTransitioningRef: MutableRefObject<boolean>;
}) {
  const { camera } = useThree();
  const targetPosition = useMemo(
    () => new THREE.Vector3(...activeViewpoint.position),
    [activeViewpoint.position],
  );
  const targetLookAt = useMemo(
    () => new THREE.Vector3(...activeViewpoint.target),
    [activeViewpoint.target],
  );

  useEffect(() => {
    isTransitioningRef.current = true;
  }, [activeViewpoint.id, isTransitioningRef]);

  useFrame((_, delta) => {
    if (!isTransitioningRef.current) {
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
      isTransitioningRef.current = false;
    }
  });

  return null;
}

function ProjectorLightRig({
  showAct,
  houseLightsBright,
}: {
  showAct: ShowAct;
  houseLightsBright: boolean;
}) {
  const boothGlow = useRef<THREE.PointLight>(null);
  const projectorSpot = useRef<THREE.SpotLight>(null);
  const warmFill = useRef<THREE.PointLight>(null);
  const coolFill = useRef<THREE.PointLight>(null);
  const supplyReel = useRef<THREE.Group>(null);
  const takeupReel = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const reelSpeed = showAct === 'preshow' ? 0.8 : 1.35;
    if (supplyReel.current) {
      supplyReel.current.rotation.z += delta * reelSpeed;
    }
    if (takeupReel.current) {
      takeupReel.current.rotation.z -= delta * reelSpeed * 1.08;
    }

    const lightScale = houseLightsBright ? 1 : 0.03;
    const smoothing = 1 - Math.exp(-delta * 2.4);
    const boothPulse = 2.8 + Math.sin(clock.elapsedTime * 2.2) * 0.35;

    if (boothGlow.current) {
      boothGlow.current.intensity = THREE.MathUtils.lerp(
        boothGlow.current.intensity,
        boothPulse * lightScale,
        smoothing,
      );
    }
    if (projectorSpot.current) {
      projectorSpot.current.intensity = THREE.MathUtils.lerp(
        projectorSpot.current.intensity,
        260 * lightScale,
        smoothing,
      );
    }
    if (warmFill.current) {
      warmFill.current.intensity = THREE.MathUtils.lerp(
        warmFill.current.intensity,
        42 * lightScale,
        smoothing,
      );
    }
    if (coolFill.current) {
      coolFill.current.intensity = THREE.MathUtils.lerp(
        coolFill.current.intensity,
        35 * lightScale,
        smoothing,
      );
    }
  });

  return (
    <group>
      <spotLight
        ref={projectorSpot}
        color="#fff2c0"
        intensity={56}
        position={[0, 4.3, 5.2]}
        angle={0.34}
        penumbra={0.8}
        distance={16}
        castShadow
      />
      <pointLight ref={warmFill} color="#ff9f31" intensity={9} position={[5.6, 2.8, -6.8]} distance={8} />
      <pointLight ref={coolFill} color="#2bffff" intensity={8} position={[-4.8, 2.6, -6.8]} distance={8} />
      <ProjectorBeams houseLightsBright={houseLightsBright} />
      <group position={[0, 4.15, 5.45]}>
        <mesh castShadow>
          <boxGeometry args={[1.1, 0.38, 0.8]} />
          <meshStandardMaterial color="#11131a" metalness={0.25} roughness={0.38} />
        </mesh>
        <mesh position={[0, -0.05, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.35, 32]} />
          <meshStandardMaterial color="#252b36" emissive="#ffe9ae" emissiveIntensity={0.65} />
        </mesh>
        <pointLight ref={boothGlow} color="#ffc46b" intensity={2.8} distance={2.4} position={[0, 0.12, 0.35]} />
        <group ref={supplyReel} position={[-0.42, 0.08, 0.18]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.028, 10, 28]} />
            <meshStandardMaterial color="#1a1d24" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
            <meshStandardMaterial color="#2a3038" metalness={0.4} roughness={0.4} />
          </mesh>
        </group>
        <group ref={takeupReel} position={[0.42, 0.08, 0.18]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.11, 0.024, 10, 28]} />
            <meshStandardMaterial color="#1a1d24" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
            <meshStandardMaterial color="#2a3038" metalness={0.4} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function ProjectorBeams({ houseLightsBright }: { houseLightsBright: boolean }) {
  const warmBeam = useRef<THREE.Mesh>(null);
  const cyanBeam = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const pulse = Math.sin(clock.elapsedTime * 1.8) * 0.035;
    if (warmBeam.current) {
      warmBeam.current.scale.setScalar(1 + pulse);
    }
    if (cyanBeam.current) {
      cyanBeam.current.scale.setScalar(0.92 - pulse);
    }

    const targetWarm = houseLightsBright ? 0.11 : 0.008;
    const targetCyan = houseLightsBright ? 0.08 : 0.005;
    const smoothing = 1 - Math.exp(-delta * 2.4);

    const warmMaterial = warmBeam.current?.material;
    if (warmMaterial && warmMaterial instanceof THREE.MeshBasicMaterial) {
      warmMaterial.opacity = THREE.MathUtils.lerp(warmMaterial.opacity, targetWarm, smoothing);
    }

    const cyanMaterial = cyanBeam.current?.material;
    if (cyanMaterial && cyanMaterial instanceof THREE.MeshBasicMaterial) {
      cyanMaterial.opacity = THREE.MathUtils.lerp(cyanMaterial.opacity, targetCyan, smoothing);
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

function CinemaRoom({ houseLightsBright }: { houseLightsBright: boolean }) {
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
      <BirthdayBackboard />
      <mesh position={[0, 0.32, 3.9]} receiveShadow>
        <boxGeometry args={[12, 0.64, 0.18]} />
        <meshStandardMaterial color="#120b07" roughness={0.84} />
      </mesh>
      <FestivalStringLights houseLightsBright={houseLightsBright} />
      <PalmSilhouettes />
      <AisleLights houseLightsBright={houseLightsBright} />
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

function FestivalStringLights({ houseLightsBright }: { houseLightsBright: boolean }) {
  const bulbs = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        x: -6.6 + index * 1.2,
        y: 3.95 + Math.sin(index * 0.8) * 0.18,
        z: 1.6 - index * 0.36,
      })),
    [],
  );
  const lightRefs = useRef<Array<THREE.PointLight | null>>([]);
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((_, delta) => {
    const targetIntensity = houseLightsBright ? 2.4 : 0.04;
    const targetEmissive = houseLightsBright ? 1.4 : 0.03;
    const smoothing = 1 - Math.exp(-delta * 2.4);

    lightRefs.current.forEach((light) => {
      if (light) {
        light.intensity = THREE.MathUtils.lerp(light.intensity, targetIntensity, smoothing);
      }
    });

    meshRefs.current.forEach((mesh) => {
      const material = mesh?.material;
      if (material && material instanceof THREE.MeshStandardMaterial) {
        material.emissiveIntensity = THREE.MathUtils.lerp(
          material.emissiveIntensity,
          targetEmissive,
          smoothing,
        );
      }
    });
  });

  return (
    <group>
      {bulbs.map((bulb, index) => (
        <group key={index} position={[bulb.x, bulb.y, bulb.z]}>
          <pointLight
            ref={(node) => {
              lightRefs.current[index] = node;
            }}
            color={index % 2 ? '#ffd082' : '#8df5ff'}
            intensity={0.28}
            distance={2.6}
          />
          <mesh
            ref={(node) => {
              meshRefs.current[index] = node;
            }}
          >
            <sphereGeometry args={[0.055, 12, 8]} />
            <meshStandardMaterial
              color={index % 2 ? '#ffd082' : '#8df5ff'}
              emissive={index % 2 ? '#ffd082' : '#8df5ff'}
              emissiveIntensity={0.18}
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

function AisleLights({ houseLightsBright }: { houseLightsBright: boolean }) {
  const lights = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        z: -4.8 + index * 1.25,
        side: index % 2 === 0 ? -1 : 1,
      })),
    [],
  );
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((_, delta) => {
    const targetEmissive = houseLightsBright ? 1.1 : 0.03;
    const smoothing = 1 - Math.exp(-delta * 2.4);

    meshRefs.current.forEach((mesh) => {
      const material = mesh?.material;
      if (material && material instanceof THREE.MeshStandardMaterial) {
        material.emissiveIntensity = THREE.MathUtils.lerp(
          material.emissiveIntensity,
          targetEmissive,
          smoothing,
        );
      }
    });
  });

  return (
    <group>
      {lights.map((light, index) => (
        <mesh
          key={index}
          ref={(node) => {
            meshRefs.current[index] = node;
          }}
          position={[light.side * 7.88, 0.08, light.z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.035, 0.035, 0.5, 16]} />
          <meshStandardMaterial
            color="#ff9f2d"
            emissive="#ff9f2d"
            emissiveIntensity={0.12}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

const BIRTHDAY_BOARD_WIDTH = 9.6;
const BIRTHDAY_BOARD_HEIGHT = 2.35;

type TrailPoint = { x: number; y: number; life: number };
type SparkPoint = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type BalloonPoint = {
  x: number;
  y: number;
  vy: number;
  phase: number;
  scale: number;
  variant: number;
  tilt: number;
};

const BALLOON_VARIANTS = [
  { fill: '#ff4d6d', highlight: '#ffb3c1', stringAngle: -24 },
  { fill: '#ffd166', highlight: '#fff0b3', stringAngle: 14 },
  { fill: '#4cc9f0', highlight: '#bdeafe', stringAngle: -8 },
  { fill: '#b794ff', highlight: '#e4d4ff', stringAngle: 22 },
  { fill: '#ff9f1c', highlight: '#ffd6a5', stringAngle: -16 },
  { fill: '#06d6a0', highlight: '#b7f7dc', stringAngle: 6 },
  { fill: '#f72585', highlight: '#ffafcc', stringAngle: -30 },
  { fill: '#90be6d', highlight: '#d8f3a0', stringAngle: 18 },
  { fill: '#48cae4', highlight: '#caf0f8', stringAngle: -12 },
  { fill: '#ff758f', highlight: '#ffc2d1', stringAngle: 26 },
] as const;

function createBalloonVariantTexture(variant: (typeof BALLOON_VARIANTS)[number]) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 168;
  const context = canvas.getContext('2d');

  if (context) {
    const centerX = canvas.width / 2;
    const centerY = 58;
    const knotY = centerY + 30;
    const stringLength = 42;
    const stringRadians = (variant.stringAngle * Math.PI) / 180;
    const stringEndX = centerX + Math.sin(stringRadians) * stringLength * 0.55;
    const stringEndY = knotY + Math.cos(stringRadians) * stringLength;
    const stringCurveX = centerX + Math.sin(stringRadians) * stringLength * 0.28;
    const stringCurveY = knotY + Math.cos(stringRadians) * stringLength * 0.55;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = 'round';
    context.strokeStyle = '#eadfce';
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(centerX, knotY + 2);
    context.quadraticCurveTo(stringCurveX, stringCurveY, stringEndX, stringEndY);
    context.stroke();

    context.fillStyle = variant.fill;
    context.beginPath();
    context.ellipse(centerX, centerY, 27, 33, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = variant.highlight;
    context.beginPath();
    context.ellipse(centerX - 9, centerY - 11, 8, 12, -0.45, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#2a1208';
    context.beginPath();
    context.moveTo(centerX - 4, knotY + 1);
    context.lineTo(centerX + 4, knotY + 1);
    context.lineTo(centerX, knotY + 6);
    context.closePath();
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function BirthdayBackboard() {
  const [isHovered, setIsHovered] = useState(false);
  const pointerLocal = useRef(new THREE.Vector2(0, 0));
  const backFaceZ = -8.96;

  return (
    <group position={[0, 2.35, backFaceZ]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[BIRTHDAY_BOARD_WIDTH, BIRTHDAY_BOARD_HEIGHT]} />
        <meshStandardMaterial color="#160b06" roughness={0.72} emissive="#4a2208" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[BIRTHDAY_BOARD_WIDTH - 0.24, BIRTHDAY_BOARD_HEIGHT - 0.24]} />
        <meshStandardMaterial color="#241208" roughness={0.55} metalness={0.18} />
      </mesh>
      <mesh position={[0, BIRTHDAY_BOARD_HEIGHT * 0.5 - 0.04, 0.05]}>
        <boxGeometry args={[BIRTHDAY_BOARD_WIDTH, 0.06, 0.03]} />
        <meshStandardMaterial color="#ffb84d" emissive="#ffb84d" emissiveIntensity={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, -BIRTHDAY_BOARD_HEIGHT * 0.5 + 0.04, 0.05]}>
        <boxGeometry args={[BIRTHDAY_BOARD_WIDTH, 0.06, 0.03]} />
        <meshStandardMaterial color="#ffb84d" emissive="#ffb84d" emissiveIntensity={0.55} roughness={0.35} />
      </mesh>
      <Text
        position={[0, 0, 0.08]}
        fontSize={0.5}
        maxWidth={8.8}
        textAlign="center"
        color="#ffdf8b"
        anchorX="center"
        anchorY="middle"
        outlineColor="#120704"
        outlineWidth={0.024}
      >
        Happy Birthday Ollie
      </Text>
      <pointLight color="#ffc86b" intensity={6} distance={4.5} position={[0, 0, 0.55]} />
      <mesh
        position={[0, 0, 0.16]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setIsHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setIsHovered(false);
          document.body.style.cursor = 'auto';
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          if (!event.uv) {
            return;
          }

          pointerLocal.current.set(
            (event.uv.x - 0.5) * BIRTHDAY_BOARD_WIDTH,
            (event.uv.y - 0.5) * BIRTHDAY_BOARD_HEIGHT,
          );
        }}
      >
        <planeGeometry args={[BIRTHDAY_BOARD_WIDTH, BIRTHDAY_BOARD_HEIGHT]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <BirthdayHoverCelebration active={isHovered} pointerLocal={pointerLocal} />
    </group>
  );
}

function BirthdayHoverCelebration({
  active,
  pointerLocal,
}: {
  active: boolean;
  pointerLocal: MutableRefObject<THREE.Vector2>;
}) {
  const trailGroup = useRef<THREE.Group>(null);
  const sparkGroup = useRef<THREE.Group>(null);
  const balloonGroup = useRef<THREE.Group>(null);
  const trails = useRef<TrailPoint[]>([]);
  const sparks = useRef<SparkPoint[]>([]);
  const balloons = useRef<BalloonPoint[]>([]);
  const lastSparkTime = useRef(0);
  const lastBalloonTime = useRef(0);

  const trailMeshes = useMemo(
    () =>
      Array.from({ length: 28 }, () => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 10, 10),
          new THREE.MeshBasicMaterial({
            color: '#ffe08a',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        mesh.visible = false;
        return mesh;
      }),
    [],
  );

  const sparkMeshes = useMemo(
    () =>
      Array.from({ length: 72 }, () => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 8, 8),
          new THREE.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        mesh.visible = false;
        return mesh;
      }),
    [],
  );

  const balloonTextures = useMemo(
    () => BALLOON_VARIANTS.map((variant) => createBalloonVariantTexture(variant)),
    [],
  );

  const balloonSprites = useMemo(
    () =>
      Array.from({ length: 10 }, () => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: balloonTextures[0],
            transparent: true,
            depthWrite: false,
            opacity: 0,
          }),
        );
        sprite.center.set(0.5, 0.38);
        sprite.visible = false;
        return sprite;
      }),
    [balloonTextures],
  );

  useEffect(() => {
    const trailRoot = trailGroup.current;
    const sparkRoot = sparkGroup.current;
    const balloonRoot = balloonGroup.current;
    if (!trailRoot || !sparkRoot || !balloonRoot) {
      return;
    }

    trailMeshes.forEach((mesh) => trailRoot.add(mesh));
    sparkMeshes.forEach((mesh) => sparkRoot.add(mesh));
    balloonSprites.forEach((sprite) => balloonRoot.add(sprite));

    return () => {
      trailMeshes.forEach((mesh) => trailRoot.remove(mesh));
      sparkMeshes.forEach((mesh) => sparkRoot.remove(mesh));
      balloonSprites.forEach((sprite) => balloonRoot.remove(sprite));
      balloonTextures.forEach((texture) => texture.dispose());
    };
  }, [balloonSprites, balloonTextures, sparkMeshes, trailMeshes]);

  useFrame(({ clock }, delta) => {
    if (!active) {
      trails.current = [];
      sparks.current = [];
      balloons.current = [];
      trailMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
      sparkMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
      balloonSprites.forEach((sprite) => {
        sprite.visible = false;
      });
      return;
    }

    const elapsed = clock.elapsedTime;
    const pointer = pointerLocal.current;

    trails.current.push({ x: pointer.x, y: pointer.y, life: 1 });
    trails.current = trails.current
      .map((point) => ({ ...point, life: point.life - delta * 1.9 }))
      .filter((point) => point.life > 0)
      .slice(-trailMeshes.length);

    if (elapsed - lastSparkTime.current > 0.55) {
      lastSparkTime.current = elapsed;
      const burstX = pointer.x * 0.35 + (Math.random() - 0.5) * BIRTHDAY_BOARD_WIDTH * 0.45;
      const burstY = pointer.y * 0.35 + (Math.random() - 0.5) * BIRTHDAY_BOARD_HEIGHT * 0.45;
      const colors = ['#ffd56a', '#ff7eb3', '#6ef2ff', '#ff9f4a', '#c89bff'];

      for (let index = 0; index < 16; index += 1) {
        const angle = (Math.PI * 2 * index) / 16 + Math.random() * 0.25;
        const speed = 0.55 + Math.random() * 0.85;
        sparks.current.push({
          x: burstX,
          y: burstY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.75 + Math.random() * 0.35,
          color: colors[index % colors.length],
        });
      }
    }

    if (elapsed - lastBalloonTime.current > 1.05) {
      lastBalloonTime.current = elapsed;
      balloons.current.push({
        x: pointer.x * 0.4 + (Math.random() - 0.5) * BIRTHDAY_BOARD_WIDTH * 0.55,
        y: -BIRTHDAY_BOARD_HEIGHT * 0.42,
        vy: 0.32 + Math.random() * 0.34,
        phase: Math.random() * Math.PI * 2,
        scale: 0.38 + Math.random() * 0.26,
        variant: Math.floor(Math.random() * balloonTextures.length),
        tilt: (Math.random() - 0.5) * 0.42,
      });
    }

    sparks.current = sparks.current
      .map((spark) => ({
        ...spark,
        x: spark.x + spark.vx * delta,
        y: spark.y + spark.vy * delta,
        vy: spark.vy - delta * 0.35,
        vx: spark.vx * 0.985,
        life: spark.life - delta * 1.15,
      }))
      .filter((spark) => spark.life > 0)
      .slice(-sparkMeshes.length);

    balloons.current = balloons.current
      .map((balloon) => ({
        ...balloon,
        y: balloon.y + balloon.vy * delta,
        x: balloon.x + Math.sin(elapsed * (1.8 + balloon.variant * 0.12) + balloon.phase) * delta * 0.16,
      }))
      .filter((balloon) => balloon.y < BIRTHDAY_BOARD_HEIGHT * 0.72)
      .slice(-balloonSprites.length);

    trailMeshes.forEach((mesh, index) => {
      const point = trails.current[index];
      if (!point) {
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      mesh.position.set(point.x, point.y, 0.22);
      mesh.scale.setScalar(0.55 + point.life * 0.65);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = point.life * 0.85;
    });

    sparkMeshes.forEach((mesh, index) => {
      const spark = sparks.current[index];
      if (!spark) {
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      mesh.position.set(spark.x, spark.y, 0.24);
      mesh.scale.setScalar(0.45 + spark.life * 0.8);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.set(spark.color);
      material.opacity = spark.life;
    });

    balloonSprites.forEach((sprite, index) => {
      const balloon = balloons.current[index];
      if (!balloon) {
        sprite.visible = false;
        return;
      }

      sprite.visible = true;
      sprite.position.set(balloon.x, balloon.y, 0.22);
      const size = balloon.scale;
      sprite.scale.set(size * 0.92, size * 1.12, 1);
      const material = sprite.material as THREE.SpriteMaterial;
      material.map = balloonTextures[balloon.variant];
      material.rotation =
        balloon.tilt + Math.sin(elapsed * 1.6 + balloon.phase) * 0.12;
      material.opacity = 0.96;
    });
  });

  return (
    <group position={[0, 0, 0]}>
      <group ref={trailGroup} />
      <group ref={sparkGroup} />
      <group ref={balloonGroup} />
    </group>
  );
}

function FloatingScreen({
  curtainOpen,
  showCaptions,
  houseLightsBright,
}: {
  curtainOpen: boolean;
  showCaptions: boolean;
  houseLightsBright: boolean;
}) {
  const { camera } = useThree();
  const [behindScreen, setBehindScreen] = useState(false);

  useFrame(() => {
    const next = camera.position.z < -7;
    setBehindScreen((current) => (current === next ? current : next));
  });

  const captionsVisible = showCaptions && !behindScreen;
  const screenMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    const smoothing = 1 - Math.exp(-delta * 2.4);
    const targetEmissive = houseLightsBright ? 0.18 : 0.008;
    const targetRing = houseLightsBright ? 0.22 : 0.015;

    if (screenMaterial.current) {
      screenMaterial.current.emissiveIntensity = THREE.MathUtils.lerp(
        screenMaterial.current.emissiveIntensity,
        targetEmissive,
        smoothing,
      );
    }

    if (ringMaterial.current) {
      ringMaterial.current.opacity = THREE.MathUtils.lerp(
        ringMaterial.current.opacity,
        targetRing,
        smoothing,
      );
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.035} floatIntensity={0.16}>
      <group position={[0, 2.72, -7.45]} rotation={[0.02, 0, 0]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[6.45, 2.75]} />
          <meshStandardMaterial
            ref={screenMaterial}
            color="#07131b"
            emissive="#2ef3ff"
            emissiveIntensity={0.008}
            roughness={0.18}
          />
        </mesh>
        <ScreenGlow houseLightsBright={houseLightsBright} />
        {curtainOpen && <RollingMediaStrip showCaptions={captionsVisible} />}
        <ScreenCurtain open={curtainOpen} />
        <mesh position={[0, 0, 0.08]}>
          <ringGeometry args={[3.55, 3.7, 4]} />
          <meshBasicMaterial
            ref={ringMaterial}
            color="#ffb34a"
            transparent
            opacity={0.015}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </Float>
  );
}

function ScreenCurtain({ open }: { open: boolean }) {
  const leftCurtain = useRef<THREE.Mesh>(null);
  const rightCurtain = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const target = open ? 0.02 : 1;
    const smoothing = 1 - Math.exp(-delta * 2.8);

    if (leftCurtain.current) {
      leftCurtain.current.scale.x = THREE.MathUtils.lerp(leftCurtain.current.scale.x, target, smoothing);
    }
    if (rightCurtain.current) {
      rightCurtain.current.scale.x = THREE.MathUtils.lerp(rightCurtain.current.scale.x, target, smoothing);
    }
  });

  return (
    <group position={[0, 0, 0.18]}>
      <mesh ref={leftCurtain} position={[-1.62, 0, 0]}>
        <planeGeometry args={[3.24, 2.82]} />
        <meshStandardMaterial color="#4a1018" roughness={0.92} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rightCurtain} position={[1.62, 0, 0]}>
        <planeGeometry args={[3.24, 2.82]} />
        <meshStandardMaterial color="#4a1018" roughness={0.92} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ScreenGlow({ houseLightsBright }: { houseLightsBright: boolean }) {
  const glow = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    if (glow.current) {
      glow.current.scale.set(
        1 + Math.sin(clock.elapsedTime * 1.4) * 0.018,
        1 + Math.cos(clock.elapsedTime * 1.1) * 0.02,
        1,
      );
    }

    const material = glow.current?.material;
    if (material && material instanceof THREE.MeshBasicMaterial) {
      const targetOpacity = houseLightsBright ? 0.13 : 0.006;
      const smoothing = 1 - Math.exp(-delta * 2.4);
      material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, smoothing);
    }
  });

  return (
    <mesh ref={glow} position={[0, 0, 0.11]} renderOrder={4}>
      <planeGeometry args={[7.5, 3.8]} />
      <meshBasicMaterial
        color="#ffc15c"
        transparent
        opacity={0.006}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function RollingMediaStrip({ showCaptions }: { showCaptions: boolean }) {
  const mediaItems = useMediaItems();

  return (
    <group position={[0, 0, 0.16]}>
      {mediaItems.map((item, index) => (
        <RollingMediaPanel
          key={item.src ?? item.title}
          item={item}
          index={index}
          itemCount={mediaItems.length}
          showCaption={showCaptions}
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

function RollingMediaPanel({
  item,
  index,
  itemCount,
  showCaption,
}: {
  item: MediaItem;
  index: number;
  itemCount: number;
  showCaption: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const [photoReady, setPhotoReady] = useState(
    () => Boolean(item.src && rollingPhotoTextureCache.has(item.src)),
  );
  const accent = new THREE.Color(item.accent);
  const base = new THREE.Color(item.colorA);
  const dark = item.colorB;
  const blendedAccent = useMemo(
    () => new THREE.Color(item.colorB).lerp(new THREE.Color(item.accent), 0.3),
    [item.accent, item.colorB],
  );
  const stillCaption = useMemo(() => stillCaptionForSrc(item.src), [item.src]);

  useEffect(() => {
    if (!item.src) {
      setPhotoReady(false);
      return;
    }

    if (rollingPhotoTextureCache.has(item.src)) {
      setPhotoReady(true);
      return;
    }

    let isMounted = true;
    setPhotoReady(false);

    loadRollingPhotoTexture(item.src).then((texture) => {
      if (isMounted) {
        setPhotoReady(Boolean(texture));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [item.src]);

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
        hasMedia={photoReady}
      />
      {item.src ? <RollingPhotoSurface src={item.src} dark={dark} /> : null}
      {showCaption && photoReady && item.src && stillCaption && (
        <Html
          position={[0, -0.65, 0.06]}
          center
          distanceFactor={7.2}
          className="still-caption"
        >
          <div>
            <span>{stillCaption.city} · {stillCaption.year}</span>
            <em>{stillCaption.caption}</em>
          </div>
        </Html>
      )}
      <mesh position={[-0.34, -0.06, 0.09]} rotation={[0, 0, -0.26]}>
        <planeGeometry args={[0.92, 0.62]} />
        <meshBasicMaterial
          color={blendedAccent}
          transparent
          opacity={photoReady ? 0.06 : 0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.5, -0.18, 0.1]} rotation={[0, 0, 0.3]}>
        <planeGeometry args={[0.84, 0.48]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={photoReady ? 0.08 : 0.52}
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
      ) : photoReady ? null : (
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

function SeatRows({
  showAct,
  collectedClueIds,
  uiOverlayOpen,
}: {
  showAct: ShowAct;
  collectedClueIds: string[];
  uiOverlayOpen: boolean;
}) {
  const collectedSet = useMemo(() => new Set(collectedClueIds), [collectedClueIds]);
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
                seatId={seatId}
                hasGift={GIFT_SEATS.has(seatId)}
                isCollected={collectedSet.has(seatId)}
                showAct={showAct}
                uiOverlayOpen={uiOverlayOpen}
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
  seatId,
  hasGift,
  isCollected,
  showAct,
  uiOverlayOpen,
}: {
  position: [number, number, number];
  seatId: string;
  hasGift: boolean;
  isCollected: boolean;
  showAct: ShowAct;
  uiOverlayOpen: boolean;
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
      {hasGift && (
        <GiftHint
          seatId={seatId}
          isCollected={isCollected}
          showAct={showAct}
          chairPosition={position}
          uiOverlayOpen={uiOverlayOpen}
        />
      )}
    </group>
  );
}

function GiftHint({
  seatId,
  isCollected,
  showAct,
  chairPosition,
  uiOverlayOpen,
}: {
  seatId: string;
  isCollected: boolean;
  showAct: ShowAct;
  chairPosition: [number, number, number];
  uiOverlayOpen: boolean;
}) {
  const gift = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [showLabel, setShowLabel] = useState(false);
  const chairWorld = useMemo(
    () => new THREE.Vector3(...chairPosition),
    [chairPosition],
  );

  useFrame(({ clock }) => {
    if (gift.current) {
      gift.current.rotation.y = Math.sin(clock.elapsedTime * 1.7) * 0.16;
      gift.current.position.y = 0.76 + Math.sin(clock.elapsedTime * 2.4) * 0.025;
    }

    const inAuditorium = showAct === 'auditorium' || showAct === 'backstage';
    const distance = camera.position.distanceTo(chairWorld);
    setShowLabel(!uiOverlayOpen && inAuditorium && distance < 3.8);
  });

  const [row, seat] = seatId.split(':');
  const label = isCollected ? `Scene collected · R${row} S${seat}` : 'Hidden scene';

  return (
    <group ref={gift} position={[0, 0.76, -0.08]}>
      <pointLight color="#ffcf68" intensity={showLabel ? 7 : 3.2} distance={1.5} />
      <mesh castShadow>
        <boxGeometry args={[0.28, 0.24, 0.28]} />
        <meshStandardMaterial
          color="#ffb12f"
          emissive="#ff8c1a"
          emissiveIntensity={showLabel ? 0.38 : 0.22}
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
      {showLabel && (
        <Html
          position={[0, 0.38, 0]}
          center
          distanceFactor={9}
          occlude
          zIndexRange={[40, 0]}
          className="gift-label"
        >
          {label}
        </Html>
      )}
    </group>
  );
}

export default App;
