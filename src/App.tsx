import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, OrbitControls, Text } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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

const GIFT_SEATS = new Set(['0:-2', '1:1', '2:-1', '3:2']);

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
  return (
    <main className="app-shell">
      <Canvas
        shadows
        camera={{ position: [0, 3.2, 8.5], fov: 48 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#030405']} />
        <fog attach="fog" args={['#050506', 8, 24]} />
        <Suspense fallback={null}>
          <CinemaScene />
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
        <h1>Drag to explore the floating screen and hidden chair gifts.</h1>
        <p>Scroll to zoom. The glowing presents are hint markers tucked into the seats.</p>
      </section>
      <div className="vignette" />
    </main>
  );
}

function CinemaScene() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <ProjectorLightRig />
      <CinemaRoom />
      <FloatingScreen />
      <SeatRows />
      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minDistance={4.5}
        maxDistance={14}
        maxPolarAngle={Math.PI * 0.48}
        target={[0, 1.5, -2.5]}
      />
    </>
  );
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

    const loader = new THREE.TextureLoader();
    let imageTexture: THREE.Texture | null = null;

    loader.load(
      item.src,
      (loadedTexture) => {
        if (isDisposed) {
          loadedTexture.dispose();
          return;
        }

        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        imageTexture = loadedTexture;
        setTexture(loadedTexture);
      },
      undefined,
      () => {
        if (!isDisposed) {
          setTexture(null);
        }
      },
    );

    return () => {
      isDisposed = true;
      imageTexture?.dispose();
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
        <planeGeometry args={[1.6, 0.82]} />
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
          opacity={mediaTexture ? 0.16 : 0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.5, -0.18, 0.1]} rotation={[0, 0, 0.3]}>
        <planeGeometry args={[0.84, 0.48]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={mediaTexture ? 0.18 : 0.52}
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
        position={[-0.84, -0.49, 0.11]}
        fontSize={0.1}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        outlineColor="#000000"
        outlineWidth={0.004}
      >
        {item.title}
      </Text>
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
      Array.from({ length: 4 }, (_, row) => ({
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
          {[-3, -2, -1, 0, 1, 2, 3].map((column) => (
            <CinemaChair
              key={`${row}:${column}`}
              position={[column * 1.25, 0, 0]}
              hasGift={GIFT_SEATS.has(`${row}:${column}`)}
              label={`Hint ${row + 1}.${Math.abs(column) + 1}`}
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
