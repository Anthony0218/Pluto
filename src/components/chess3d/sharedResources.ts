import * as THREE from "three";

/**
 * Geometries and materials shared by every square, tile and marker. Boards can
 * have up to 256 cells, so one instance per kind (instead of per mesh) keeps
 * GPU memory and draw setup low. They live for the app's lifetime and are never
 * disposed by individual components.
 */
export const GEOMETRY = {
  square: new THREE.BoxGeometry(1, 0.15, 1),
  hole: new THREE.BoxGeometry(1, 0.04, 1),
  blockedCap: new THREE.BoxGeometry(0.86, 0.34, 0.86),
  disc: new THREE.CircleGeometry(0.15, 32),
  glow: new THREE.CircleGeometry(0.42, 40),
  ring: new THREE.RingGeometry(0.35, 0.46, 48),
  frame: new THREE.RingGeometry(0.56, 0.66, 4, 1, Math.PI / 4),
  diamond: new THREE.RingGeometry(0.12, 0.26, 4),
  plane: new THREE.PlaneGeometry(0.98, 0.98),
  portalRing: new THREE.TorusGeometry(0.34, 0.045, 12, 48),
  portalCore: new THREE.CircleGeometry(0.3, 40),
  promotionFrame: new THREE.RingGeometry(0.38, 0.45, 4, 1, Math.PI / 4),
  goalGem: new THREE.OctahedronGeometry(0.13),
  arrow: new THREE.ConeGeometry(0.16, 0.42, 3),
  pulseRing: new THREE.RingGeometry(0.42, 0.5, 48),
};

const standardCache = new Map<string, THREE.MeshStandardMaterial>();

/** Cached PBR material — squares with the same finish share one instance. */
export function standardMaterial(color: string, roughness: number, metalness: number, emissive = "#000000", emissiveIntensity = 0) {
  const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}`;
  let material = standardCache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
    standardCache.set(key, material);
  }
  return material;
}

// Normal (not additive) blending keeps markers coloured on light squares instead of washing out to white.
const glowMaterial = (color: string, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
const flatMaterial = (color: string, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });

/** Marker materials: blue = move, red = capture, gold = special/selected. */
export const MARK_MATERIALS = {
  moveCore: glowMaterial("#38bdf8", 0.95),
  moveGlow: glowMaterial("#0284c7", 0.28),
  captureRing: glowMaterial("#ef4444", 0.9),
  captureGlow: glowMaterial("#dc2626", 0.26),
  special: glowMaterial("#fbbf24", 0.95),
  specialGlow: glowMaterial("#f59e0b", 0.26),
  selected: glowMaterial("#fcd34d", 0.95),
  target: glowMaterial("#38bdf8", 0.9),
  lastFrom: flatMaterial("#f59e0b", 0.16),
  lastTo: flatMaterial("#fbbf24", 0.26),
  check: glowMaterial("#ef4444", 0.55),
  illegal: flatMaterial("#71717a", 0.5),
};

export const TILE_MATERIALS = {
  hole: new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.9, metalness: 0 }),
  blocked: new THREE.MeshStandardMaterial({ color: "#3f3b37", roughness: 0.85, metalness: 0.05 }),
  portalRing: new THREE.MeshStandardMaterial({ color: "#a78bfa", emissive: "#7c3aed", emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.6 }),
  portalCore: glowMaterial("#8b5cf6", 0.5),
  promotion: glowMaterial("#eab308", 0.8),
  goal: new THREE.MeshStandardMaterial({ color: "#4ade80", emissive: "#16a34a", emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.4 }),
  spawn: glowMaterial("#14b8a6", 0.7),
  danger: glowMaterial("#ef4444", 0.45),
  ice: new THREE.MeshStandardMaterial({ color: "#bae6fd", transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3 }),
  oneWay: new THREE.MeshStandardMaterial({ color: "#fb923c", emissive: "#ea580c", emissiveIntensity: 0.8, roughness: 0.4 }),
  teleport: glowMaterial("#d946ef", 0.75),
};

/** Called once per frame by the scene: one opacity update animates every marker. */
export function animateSharedMaterials(time: number, reducedMotion: boolean) {
  const wave = reducedMotion ? 0.5 : (Math.sin(time * 3.2) + 1) / 2;
  MARK_MATERIALS.moveGlow.opacity = 0.18 + wave * 0.2;
  MARK_MATERIALS.captureGlow.opacity = 0.16 + wave * 0.2;
  MARK_MATERIALS.specialGlow.opacity = 0.16 + wave * 0.2;
  MARK_MATERIALS.check.opacity = 0.35 + wave * 0.35;
  TILE_MATERIALS.portalCore.opacity = 0.3 + wave * 0.35;
  TILE_MATERIALS.danger.opacity = 0.25 + wave * 0.3;
  TILE_MATERIALS.portalRing.emissiveIntensity = 1.2 + wave * 0.9;
}
