import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Float } from "@react-three/drei";
import * as THREE from "three";

/**
 * The product inspection scene.
 *
 * A packaged commodity standing under a scanning pass, with the declaration
 * regions on its label picked out and read. The scene is deliberately small —
 * no loaded models, no shadow maps, no post-processing — because the
 * inspection workflow must stay fast and this is decoration in service of an
 * explanation, not the product itself.
 *
 * Budget: two meshes, one instanced mesh, one procedural texture, two lights.
 */

const BRAND = "#2b8a52";
const TEAL = "#0e8f84";

/**
 * The label is drawn to a canvas and used as a texture, so the pack carries
 * the same declarations the interface talks about rather than a blank panel.
 */
function useLabelTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#f7f5ef";
    ctx.fillRect(0, 0, 512, 720);

    // Header band
    const gradient = ctx.createLinearGradient(0, 0, 512, 190);
    gradient.addColorStop(0, "#1f7a45");
    gradient.addColorStop(1, "#0e8f84");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 190);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 46px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillText("Organic", 34, 78);
    ctx.font = "700 46px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillText("Mixed Vegetables", 34, 130);
    ctx.font = "400 24px 'DM Sans', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText("Farm Fresh & Natural", 34, 168);

    // Declaration block
    ctx.fillStyle = "#16241c";
    const lines = [
      ["Net Quantity", "500 g"],
      ["MRP (Incl. of all taxes)", "Rs 50.00"],
      ["Mfd. by", "Sahyadri Foods Pvt Ltd"],
      ["", "Pune, Maharashtra - 411001"],
      ["Consumer care", "1800-123-4567"],
      ["Country of origin", "INDIA"],
      ["Best before", "12/2027"],
    ];

    let y = 268;
    for (const [label, value] of lines) {
      if (label) {
        ctx.font = "500 20px 'DM Sans', system-ui, sans-serif";
        ctx.fillStyle = "#5d6b62";
        ctx.fillText(label, 34, y);
      }
      ctx.font = "600 27px 'DM Sans', system-ui, sans-serif";
      ctx.fillStyle = "#16241c";
      ctx.fillText(value, 34, y + (label ? 32 : 0));
      y += label ? 74 : 40;
    }

    // Barcode strip
    ctx.fillStyle = "#16241c";
    for (let x = 34; x < 300; x += 7) {
      const width = 1 + ((x * 13) % 4);
      ctx.fillRect(x, 640, width, 52);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

/** Declaration regions the scanner picks out, in label-plane coordinates. */
const REGIONS = [
  { y: 0.30, w: 0.9, h: 0.14 },
  { y: 0.04, w: 0.72, h: 0.14 },
  { y: -0.28, w: 0.82, h: 0.14 },
  { y: -0.6, w: 0.56, h: 0.14 },
];

function Package() {
  const group = useRef<THREE.Group>(null);
  const texture = useLabelTexture();

  useFrame((state) => {
    if (!group.current) return;
    // A slow examination drift, not a product turntable.
    const t = state.clock.elapsedTime;
    group.current.rotation.y = Math.sin(t * 0.28) * 0.32;
    group.current.rotation.x = Math.sin(t * 0.2) * 0.05;
  });

  return (
    <group ref={group}>
      <RoundedBox args={[1.62, 2.25, 0.6]} radius={0.09} smoothness={4}>
        <meshStandardMaterial color="#e9efe9" roughness={0.55} metalness={0.08} />
      </RoundedBox>

      {/* Front label */}
      <mesh position={[0, 0, 0.305]}>
        <planeGeometry args={[1.45, 2.02]} />
        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.72} />
        ) : (
          <meshStandardMaterial color="#f7f5ef" roughness={0.72} />
        )}
      </mesh>

      {/* Regions the reader is looking at */}
      {REGIONS.map((region) => (
        <mesh key={region.y} position={[0, region.y, 0.309]}>
          <planeGeometry args={[region.w, region.h]} />
          <meshBasicMaterial color={BRAND} transparent opacity={0.14} />
        </mesh>
      ))}

      {/* OCR bounding boxes drawn as outlines around those regions */}
      {REGIONS.map((region) => (
        <lineSegments key={`box-${region.y}`} position={[0, region.y, 0.312]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(region.w, region.h)]} />
          <lineBasicMaterial color={TEAL} transparent opacity={0.75} />
        </lineSegments>
      ))}
    </group>
  );
}

function ScanBeam() {
  const beam = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (!beam.current || !material.current) return;
    // One pass every 3.6 seconds, fading in and out at the extremes.
    const phase = (state.clock.elapsedTime % 3.6) / 3.6;
    beam.current.position.y = 1.5 - phase * 3;
    material.current.opacity = Math.sin(phase * Math.PI) * 0.8;
  });

  return (
    <mesh ref={beam} position={[0, 1.5, 0.42]}>
      <planeGeometry args={[2.5, 0.05]} />
      <meshBasicMaterial ref={material} color={BRAND} transparent opacity={0} />
    </mesh>
  );
}

/** Data points lifting off the label as declarations are resolved. */
function DataMotes({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const seeds = useMemo(() => {
    // Deterministic scatter: a hash of the index looks unordered but is pure,
    // so the scene is identical on every mount and never flickers.
    const hash = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: count }, (_, i) => ({
      x: (hash(i + 1) - 0.5) * 3.6,
      z: (hash(i + 41) - 0.5) * 1.8 + 0.5,
      speed: 0.18 + hash(i + 83) * 0.32,
      offset: (i / count) * 3.4,
      scale: 0.014 + hash(i + 127) * 0.022,
    }));
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((seed, index) => {
      const y = ((t * seed.speed + seed.offset) % 3.4) - 1.7;
      dummy.position.set(seed.x, y, seed.z);
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={TEAL} transparent opacity={0.6} />
    </instancedMesh>
  );
}

export default function ProductScene({ compact = false }: { compact?: boolean }) {
  return (
    <Canvas
      dpr={[1, compact ? 1.35 : 1.7]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.15, 5.2], fov: 38 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.72} />
      <directionalLight position={[3.5, 4.5, 5]} intensity={1.45} color="#ffffff" />
      <directionalLight position={[-4, -1.5, 2]} intensity={0.45} color={TEAL} />

      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.35}>
        <Package />
      </Float>

      <ScanBeam />
      <DataMotes count={compact ? 16 : 30} />
    </Canvas>
  );
}
