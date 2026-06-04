import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html, OrbitControls, Text } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
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

const SPECIAL_SEATS = new Set(['2:2', '5:7']);
const GIFT_SEATS = SPECIAL_SEATS;
const SEAT_COLUMNS = [-3, -2, -1, 0, 1, 2, 3];

function seatPosition(rowNumber: number, seatNumber: number): [number, number, number] {
  const rowIndex = rowNumber - 1;
  const column = SEAT_COLUMNS[seatNumber - 1] ?? 0;

  return [column * 1.25, 1.52 + rowIndex * 0.08, -1.94 + rowIndex * 1.35];
}

type Viewpoint = {
  id: string;
  key: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  specialSeatId?: string;
};

const SCREEN_TARGET: [number, number, number] = [0, 2.55, -7.45];
const INITIAL_VIEWPOINT: Viewpoint = {
  id: 'middle-seat',
  key: '1',
  label: 'Middle seat',
  // Put the eye point just in front of the middle chair back so the screen is visible immediately.
  position: [0, 1.62, -0.9],
  target: SCREEN_TARGET,
};

const FIXED_VIEWPOINTS: Viewpoint[] = [
  INITIAL_VIEWPOINT,
  {
    id: 'left-aisle',
    key: '2',
    label: 'Left aisle',
    position: [-5.35, 1.58, -0.65],
    target: [-0.7, 2.42, -7.4],
  },
];

const MYSTERY_SEAT_CANDIDATES: Array<Pick<Viewpoint, 'position' | 'target' | 'specialSeatId'>> = [
  { position: seatPosition(2, 2), target: [-0.4, 2.46, -7.45], specialSeatId: '2:2' },
  { position: seatPosition(5, 7), target: [0.65, 2.52, -7.35], specialSeatId: '5:7' },
  { position: seatPosition(1, 2), target: [-0.35, 2.5, -7.45] },
  { position: seatPosition(1, 6), target: [0.35, 2.5, -7.45] },
  { position: seatPosition(3, 1), target: [-0.7, 2.5, -7.35] },
  { position: seatPosition(3, 7), target: [0.7, 2.5, -7.35] },
  { position: seatPosition(4, 3), target: [-0.3, 2.42, -7.35] },
  { position: seatPosition(4, 5), target: [0.3, 2.42, -7.35] },
];

function createViewpoints() {
  const shuffledSeats = [...MYSTERY_SEAT_CANDIDATES].sort(() => Math.random() - 0.5);
  const mysteryViewpoints = shuffledSeats.slice(0, 2).map((seat, index) => ({
    id: `mystery-point-${index + 1}`,
    key: String(index + 3),
    label: `Mystery point ${index + 1}`,
    ...seat,
  }));

  return [...FIXED_VIEWPOINTS, ...mysteryViewpoints];
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
  const viewpoints = useMemo(() => createViewpoints(), []);
  const mediaItems = useMediaItems();
  const [activeViewpointId, setActiveViewpointId] = useState(INITIAL_VIEWPOINT.id);
  const [visibleCloudSeatId, setVisibleCloudSeatId] = useState<string | null>(null);
  const activeViewpoint =
    viewpoints.find((viewpoint) => viewpoint.id === activeViewpointId) ?? INITIAL_VIEWPOINT;
  const cloudImageSrc = useMemo(
    () =>
      mediaItems.find((item) => item.src && item.type === 'photo')?.src ??
      mediaItems.find((item) => item.src)?.src,
    [mediaItems],
  );
  const activeCloudSeatId =
    activeViewpoint.specialSeatId && visibleCloudSeatId === activeViewpoint.specialSeatId
      ? activeViewpoint.specialSeatId
      : null;

  function selectViewpoint(viewpoint: Viewpoint) {
    setActiveViewpointId(viewpoint.id);
    setVisibleCloudSeatId((currentSeatId) => {
      if (!viewpoint.specialSeatId) {
        return null;
      }

      return currentSeatId === viewpoint.specialSeatId && activeViewpointId === viewpoint.id
        ? null
        : viewpoint.specialSeatId;
    });
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingViewpoint = viewpoints.find((viewpoint) => viewpoint.key === event.key);

      if (matchingViewpoint) {
        selectViewpoint(matchingViewpoint);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeViewpointId, viewpoints]);

  return (
    <main className="app-shell">
      <Canvas
        shadows
        camera={{ position: INITIAL_VIEWPOINT.position, fov: 58 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#030405']} />
        <fog attach="fog" args={['#050506', 8, 24]} />
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
        <h1>{activeViewpoint.label}: drag to look around the cinema.</h1>
        <p>Press 1-4 or use the buttons to move between curated viewpoints.</p>
      </section>

      <section className="viewpoint-dock" aria-label="Cinema viewpoints">
        {viewpoints.map((viewpoint) => (
          <button
            key={viewpoint.id}
            className={viewpoint.id === activeViewpoint.id ? 'active' : undefined}
            type="button"
            onClick={() => selectViewpoint(viewpoint)}
          >
            <span>{viewpoint.key}</span>
            {viewpoint.label}
          </button>
        ))}
      </section>

      {activeCloudSeatId && (
        <MysteryCloud seatId={activeCloudSeatId} imageSrc={cloudImageSrc} />
      )}
      <div className="vignette" />
    </main>
  );
}

function MysteryCloud({ seatId, imageSrc }: { seatId: string; imageSrc?: string }) {
  return (
    <section className="mystery-cloud" aria-live="polite">
      <p className="mystery-cloud__eyebrow">Gift clue found</p>
      <h2>Row {seatId.split(':')[0]} Seat {seatId.split(':')[1]}</h2>
      <div className="mystery-cloud__image">
        {imageSrc ? <img src={encodeURI(imageSrc)} alt="Mystery clue" /> : <span>?</span>}
      </div>
      <p>Hit the same mystery point again to hide this cloud.</p>
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[16, 22]} />
        <meshStandardMaterial color="#080807" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, 4.9, 0]} receiveShadow>
        <boxGeometry args={[16, 0.18, 22]} />
        <meshStandardMaterial color="#080706" roughness={0.9} />
      </mesh>
      <mesh position={[-8, 2.4, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.9, 22]} />
        <meshStandardMaterial color="#050506" roughness={0.94} />
      </mesh>
      <mesh position={[8, 2.4, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.9, 22]} />
        <meshStandardMaterial color="#0a0504" roughness={0.94} />
      </mesh>
      <mesh position={[0, 2.4, -8.7]} receiveShadow>
        <boxGeometry args={[16, 4.9, 0.22]} />
        <meshStandardMaterial color="#050405" roughness={0.88} />
      </mesh>
      <AisleLights />
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
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[6.9, 3.15, 0.12]} />
          <meshStandardMaterial
            color="#08090d"
            emissive="#0b1425"
            emissiveIntensity={0.9}
            metalness={0.2}
            roughness={0.32}
          />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[6.45, 2.75]} />
          <meshStandardMaterial
            color="#07131b"
            emissive="#2ef3ff"
            emissiveIntensity={0.18}
            roughness={0.18}
          />
        </mesh>
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
        hasMedia={Boolean(mediaTexture)}
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
          opacity={mediaTexture ? 0.08 : 0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.5, -0.18, 0.1]} rotation={[0, 0, 0.3]}>
        <planeGeometry args={[0.84, 0.48]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={mediaTexture ? 0.1 : 0.52}
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
      <Text
        position={[0.82, -0.49, 0.11]}
        fontSize={0.08}
        color={item.accent}
        anchorX="right"
        anchorY="middle"
      >
        {item.type.toUpperCase()}
      </Text>
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
      Array.from({ length: 5 }, (_, row) => ({
        row,
        z: -1.7 + row * 1.35,
        y: row * 0.08,
      })),
    [],
  );

  return (
    <group>
      {rows.map(({ row, z, y }) => (
        <group key={row} position={[0, y, z]}>
          {SEAT_COLUMNS.map((column, seatIndex) => (
            <CinemaChair
              key={`${row}:${column}`}
              position={[column * 1.25, 0, 0]}
              hasGift={GIFT_SEATS.has(`${row + 1}:${seatIndex + 1}`)}
              label={`Row ${row + 1} Seat ${seatIndex + 1}`}
            />
          ))}
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
