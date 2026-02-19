"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BlockId, collidesAt, hasSupportUnderPlayer, VoxelWorld, voxelRaycast } from "@/lib/world";

const PLAYER_HEIGHT = 1.8;
const PLAYER_HALF_WIDTH = 0.3;
const EYE_HEIGHT = 1.62;
const GRAVITY = 26;
const JUMP_VELOCITY = 8.2;
const WALK_SPEED = 4.8;
const SPRINT_SPEED = 12.8;
const CROUCH_SPEED = 2.1;
const MAX_HEARTS = 50;
const RENDER_RADIUS = 90;
const RENDER_GRID = 20;

const BREAK_HARDNESS: Partial<Record<BlockId, number>> = {
  [BlockId.Grass]: 2,
  [BlockId.Dirt]: 2,
  [BlockId.Sand]: 2,
  [BlockId.Leaves]: 2,
  [BlockId.Wood]: 3,
  [BlockId.Planks]: 3,
  [BlockId.Stone]: 5,
  [BlockId.Cobblestone]: 5,
  [BlockId.Brick]: 5,
  [BlockId.Glass]: 2,
  [BlockId.SliverOre]: 7,
  [BlockId.RubyOre]: 9
};

type InventorySlot = {
  id: string;
  label: string;
  kind: "block" | "weapon" | "tool";
  count: number;
  blockId?: BlockId;
  attack?: number;
  minePower?: number;
  mineTier?: number;
};

type Recipe = {
  id: string;
  label: string;
  cost: Array<{ slotId: string; count: number }>;
  result: { slotId: string; count: number };
};

type MobKind = "sheep" | "chicken" | "horse" | "zombie" | "skeleton" | "spider";

type MobEntity = {
  kind: MobKind;
  hostile: boolean;
  hp: number;
  group: THREE.Group;
  legs: THREE.Mesh[];
  direction: THREE.Vector3;
  turnTimer: number;
  speed: number;
  detectRange: number;
  attackDamage: number;
  attackCooldown: number;
  attackTimer: number;
  halfHeight: number;
  bobSeed: number;
};

type MobModel = {
  group: THREE.Group;
  legs: THREE.Mesh[];
  halfHeight: number;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

const INITIAL_INVENTORY: InventorySlot[] = [
  { id: "grass", label: "Grass", kind: "block", blockId: BlockId.Grass, count: 64 },
  { id: "dirt", label: "Dirt", kind: "block", blockId: BlockId.Dirt, count: 64 },
  { id: "stone", label: "Stone", kind: "block", blockId: BlockId.Stone, count: 64 },
  { id: "wood", label: "Wood", kind: "block", blockId: BlockId.Wood, count: 64 },
  { id: "planks", label: "Planks", kind: "block", blockId: BlockId.Planks, count: 20 },
  { id: "cobble", label: "Cobble", kind: "block", blockId: BlockId.Cobblestone, count: 20 },
  { id: "sand", label: "Sand", kind: "block", blockId: BlockId.Sand, count: 20 },
  { id: "brick", label: "Brick", kind: "block", blockId: BlockId.Brick, count: 0 },
  { id: "glass", label: "Glass", kind: "block", blockId: BlockId.Glass, count: 0 },
  { id: "sliver_ore", label: "Sliver Ore", kind: "block", blockId: BlockId.SliverOre, count: 0 },
  { id: "ruby_ore", label: "Ruby Ore", kind: "block", blockId: BlockId.RubyOre, count: 0 },
  { id: "wood_pickaxe", label: "Wood Pickaxe", kind: "tool", minePower: 1.05, mineTier: 1, count: 1 },
  { id: "stone_pickaxe", label: "Stone Pickaxe", kind: "tool", minePower: 1.55, mineTier: 2, count: 0 },
  { id: "sliver_pickaxe", label: "Sliver Pickaxe", kind: "tool", minePower: 2.2, mineTier: 3, count: 0 },
  { id: "knife", label: "Knife", kind: "weapon", attack: 9, count: 1 },
  { id: "wood_sword", label: "Wood Sword", kind: "weapon", attack: 13, count: 0 },
  { id: "stone_sword", label: "Stone Sword", kind: "weapon", attack: 18, count: 0 }
];

const BLOCK_TO_SLOT: Partial<Record<BlockId, string>> = {
  [BlockId.Grass]: "grass",
  [BlockId.Dirt]: "dirt",
  [BlockId.Stone]: "stone",
  [BlockId.Wood]: "wood",
  [BlockId.Leaves]: "dirt",
  [BlockId.Planks]: "planks",
  [BlockId.Cobblestone]: "cobble",
  [BlockId.Sand]: "sand",
  [BlockId.Brick]: "brick",
  [BlockId.Glass]: "glass",
  [BlockId.SliverOre]: "sliver_ore",
  [BlockId.RubyOre]: "ruby_ore"
};

const RECIPES: Recipe[] = [
  { id: "planks", label: "2 Wood -> 4 Planks", cost: [{ slotId: "wood", count: 2 }], result: { slotId: "planks", count: 4 } },
  { id: "glass", label: "4 Sand -> 2 Glass", cost: [{ slotId: "sand", count: 4 }], result: { slotId: "glass", count: 2 } },
  {
    id: "brick",
    label: "2 Dirt + 2 Stone -> 2 Brick",
    cost: [
      { slotId: "dirt", count: 2 },
      { slotId: "stone", count: 2 }
    ],
    result: { slotId: "brick", count: 2 }
  },
  {
    id: "wood_pickaxe",
    label: "2 Planks + 2 Wood -> Wood Pickaxe",
    cost: [
      { slotId: "planks", count: 2 },
      { slotId: "wood", count: 2 }
    ],
    result: { slotId: "wood_pickaxe", count: 1 }
  },
  {
    id: "stone_pickaxe",
    label: "2 Cobble + 1 Wood -> Stone Pickaxe",
    cost: [
      { slotId: "cobble", count: 2 },
      { slotId: "wood", count: 1 }
    ],
    result: { slotId: "stone_pickaxe", count: 1 }
  },
  {
    id: "sliver_pickaxe",
    label: "2 Sliver Ore + 1 Wood -> Sliver Pickaxe",
    cost: [
      { slotId: "sliver_ore", count: 2 },
      { slotId: "wood", count: 1 }
    ],
    result: { slotId: "sliver_pickaxe", count: 1 }
  },
  {
    id: "knife",
    label: "1 Stone + 1 Wood -> Knife",
    cost: [
      { slotId: "stone", count: 1 },
      { slotId: "wood", count: 1 }
    ],
    result: { slotId: "knife", count: 1 }
  },
  {
    id: "wood_sword",
    label: "2 Planks + 1 Wood -> Wood Sword",
    cost: [
      { slotId: "planks", count: 2 },
      { slotId: "wood", count: 1 }
    ],
    result: { slotId: "wood_sword", count: 1 }
  },
  {
    id: "stone_sword",
    label: "2 Cobble + 1 Wood -> Stone Sword",
    cost: [
      { slotId: "cobble", count: 2 },
      { slotId: "wood", count: 1 }
    ],
    result: { slotId: "stone_sword", count: 1 }
  }
];

type SaveDataV1 = {
  version: 1;
  seed: number;
  changes: Array<[number, number]>;
  inventoryCounts: Record<string, number>;
  selectedSlot: number;
  player: { x: number; y: number; z: number };
};

const SAVE_KEY = "minecraft_save_v1";

function createMobModel(
  bodyColor: number,
  headColor: number,
  legColor: number,
  eyeColor: number,
  detailColor: number,
  bodySize: [number, number, number],
  headSize: [number, number, number]
): MobModel {
  const group = new THREE.Group();
  const materials = [
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.86, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.84, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.9, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.3, metalness: 0.05, emissive: new THREE.Color(eyeColor).multiplyScalar(0.15) }),
    new THREE.MeshStandardMaterial({ color: detailColor, roughness: 0.82, metalness: 0.02 })
  ];

  const bodyGeo = new THREE.BoxGeometry(bodySize[0], bodySize[1], bodySize[2]);
  const headGeo = new THREE.BoxGeometry(headSize[0], headSize[1], headSize[2]);
  const legGeo = new THREE.BoxGeometry(Math.max(0.12, bodySize[0] * 0.2), Math.max(0.3, bodySize[1] * 0.56), Math.max(0.12, bodySize[2] * 0.2));
  const eyeGeo = new THREE.BoxGeometry(Math.max(0.05, headSize[0] * 0.13), Math.max(0.05, headSize[1] * 0.13), Math.max(0.03, headSize[2] * 0.1));

  const body = new THREE.Mesh(bodyGeo, materials[0]);
  body.position.y = bodySize[1] * 0.5;

  const head = new THREE.Mesh(headGeo, materials[1]);
  head.position.set(0, bodySize[1] * 0.88, bodySize[2] * 0.45);

  const eyeL = new THREE.Mesh(eyeGeo, materials[3]);
  eyeL.position.set(-headSize[0] * 0.2, head.position.y + headSize[1] * 0.05, head.position.z + headSize[2] * 0.47);
  const eyeR = new THREE.Mesh(eyeGeo, materials[3]);
  eyeR.position.set(headSize[0] * 0.2, head.position.y + headSize[1] * 0.05, head.position.z + headSize[2] * 0.47);

  const snoutGeo = new THREE.BoxGeometry(headSize[0] * 0.5, headSize[1] * 0.33, headSize[2] * 0.36);
  const snout = new THREE.Mesh(snoutGeo, materials[4]);
  snout.position.set(0, head.position.y - headSize[1] * 0.1, head.position.z + headSize[2] * 0.62);

  const stripeGeo = new THREE.BoxGeometry(bodySize[0] * 0.72, bodySize[1] * 0.2, bodySize[2] * 0.24);
  const stripe = new THREE.Mesh(stripeGeo, materials[4]);
  stripe.position.set(0, body.position.y + bodySize[1] * 0.35, 0);

  group.add(body, head, eyeL, eyeR, snout, stripe);

  const legs: THREE.Mesh[] = [];
  const legY = legGeo.parameters.height * 0.5;
  const offsets = [
    [-bodySize[0] * 0.28, legY, -bodySize[2] * 0.25],
    [bodySize[0] * 0.28, legY, -bodySize[2] * 0.25],
    [-bodySize[0] * 0.28, legY, bodySize[2] * 0.25],
    [bodySize[0] * 0.28, legY, bodySize[2] * 0.25]
  ];

  for (const offset of offsets) {
    const leg = new THREE.Mesh(legGeo, materials[2]);
    leg.position.set(offset[0], offset[1], offset[2]);
    legs.push(leg);
    group.add(leg);
  }

  return {
    group,
    legs,
    halfHeight: Math.max(bodySize[1], legGeo.parameters.height) * 0.5 + 0.2,
    materials,
    geometries: [bodyGeo, headGeo, legGeo, eyeGeo, snoutGeo, stripeGeo]
  };
}

export default function MinecraftGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const selectedSlotRef = useRef(0);
  const capsActiveRef = useRef(false);
  const inventoryRef = useRef<InventorySlot[]>(INITIAL_INVENTORY);
  const inventoryOpenRef = useRef(false);
  const heartsRef = useRef(MAX_HEARTS);
  const isDeadRef = useRef(false);
  const respawnTimerRef = useRef(0);
  const respawnShownRef = useRef(0);
  const leftMouseHeldRef = useRef(false);
  const mineProgressRef = useRef(0);
  const mineTargetRef = useRef<string>("");
  const saveNowRef = useRef<(() => void) | null>(null);
  const loadNowRef = useRef<(() => void) | null>(null);

  const [locked, setLocked] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [capsActive, setCapsActive] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventory, setInventory] = useState<InventorySlot[]>(INITIAL_INVENTORY);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [daylightPercent, setDaylightPercent] = useState(100);
  const [passiveCount, setPassiveCount] = useState(0);
  const [hostileCount, setHostileCount] = useState(0);
  const [respawnSeconds, setRespawnSeconds] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");

  const heartDisplay = useMemo(() => Array.from({ length: MAX_HEARTS }, (_, i) => i < hearts), [hearts]);

  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  useEffect(() => {
    capsActiveRef.current = capsActive;
  }, [capsActive]);

  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  useEffect(() => {
    inventoryOpenRef.current = inventoryOpen;
  }, [inventoryOpen]);

  const adjustSlotCount = (slotId: string, delta: number) => {
    setInventory((prev) => {
      const idx = prev.findIndex((slot) => slot.id === slotId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], count: Math.max(0, next[idx].count + delta) };
      return next;
    });
  };

  const canCraft = (recipe: Recipe): boolean => {
    const byId = new Map(inventoryRef.current.map((slot) => [slot.id, slot.count]));
    return recipe.cost.every((cost) => (byId.get(cost.slotId) ?? 0) >= cost.count);
  };

  const craft = (recipe: Recipe) => {
    setInventory((prev) => {
      const byId = new Map(prev.map((slot) => [slot.id, slot.count]));
      const allowed = recipe.cost.every((cost) => (byId.get(cost.slotId) ?? 0) >= cost.count);
      if (!allowed) return prev;

      for (const cost of recipe.cost) byId.set(cost.slotId, (byId.get(cost.slotId) ?? 0) - cost.count);
      byId.set(recipe.result.slotId, (byId.get(recipe.result.slotId) ?? 0) + recipe.result.count);

      return prev.map((slot) => ({ ...slot, count: Math.max(0, byId.get(slot.id) ?? slot.count) }));
    });
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let loadedSave: SaveDataV1 | null = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveDataV1;
        if (parsed?.version === 1 && Number.isFinite(parsed.seed) && Array.isArray(parsed.changes)) loadedSave = parsed;
      }
    } catch {
      loadedSave = null;
    }

    const worldSeed = loadedSave?.seed ?? Math.floor(Math.random() * 2147483647);
    const world = new VoxelWorld(undefined, undefined, undefined, worldSeed);
    world.generate();

    const changedBlocks = new Map<number, number>();
    const baselineByIndex = new Map<number, number>();

    if (loadedSave) {
      for (const [idx, block] of loadedSave.changes) {
        const layer = world.sizeX * world.sizeZ;
        const y = Math.floor(idx / layer);
        const rem = idx - y * layer;
        const z = Math.floor(rem / world.sizeX);
        const x = rem - z * world.sizeX;
        if (!world.inBounds(x, y, z)) continue;
        world.set(x, y, z, block as BlockId);
        changedBlocks.set(idx, block);
      }
    }

    const scene = new THREE.Scene();
    const daySky = new THREE.Color(0x8bc2ff);
    const nightSky = new THREE.Color(0x06111f);
    const liveSky = new THREE.Color(0x8bc2ff);
    scene.background = liveSky;
    scene.fog = new THREE.Fog(liveSky, 30, 200);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xd7efff, 0x463c32, 1.15);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff4da, 1.28);
    sun.position.set(40, 95, 24);
    scene.add(sun);

    const worldMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 });
    let worldMesh = new THREE.Mesh(new THREE.BufferGeometry(), worldMaterial);
    scene.add(worldMesh);

    const pointer = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();

    const controls = {
      yaw: 0,
      pitch: 0,
      keys: new Set<string>()
    };

    const player = {
      position: new THREE.Vector3(world.sizeX / 2, 14, world.sizeZ / 2),
      velocity: new THREE.Vector3(),
      onGround: false
    };

    if (loadedSave?.inventoryCounts) {
      setInventory((prev) =>
        prev.map((slot) => ({
          ...slot,
          count: Math.max(0, Math.floor(loadedSave?.inventoryCounts?.[slot.id] ?? slot.count))
        }))
      );
    }
    if (typeof loadedSave?.selectedSlot === "number") {
      const idx = Math.max(0, Math.min(INITIAL_INVENTORY.length - 1, loadedSave.selectedSlot));
      setSelectedSlot(idx);
      selectedSlotRef.current = idx;
    }
    if (loadedSave?.player) {
      player.position.set(loadedSave.player.x, loadedSave.player.y, loadedSave.player.z);
    }

    const mobs: MobEntity[] = [];
    const disposables: Array<{ materials: THREE.Material[]; geometries: THREE.BufferGeometry[] }> = [];

    const surfaceYAt = (x: number, z: number): number => {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      if (ix < 0 || iz < 0 || ix >= world.sizeX || iz >= world.sizeZ) return 1;
      return world.highestSolidY(ix, iz) + 1;
    };

    const randomLandPoint = (): THREE.Vector3 => {
      for (let i = 0; i < 40; i += 1) {
        const x = 10 + Math.random() * (world.sizeX - 20);
        const z = 10 + Math.random() * (world.sizeZ - 20);
        const y = surfaceYAt(x, z);
        if (y > 2) return new THREE.Vector3(x, y, z);
      }
      return new THREE.Vector3(world.sizeX / 2, 12, world.sizeZ / 2);
    };

    const randomLandPointNear = (centerX: number, centerZ: number, radius: number): THREE.Vector3 => {
      for (let i = 0; i < 50; i += 1) {
        const x = centerX + (Math.random() * 2 - 1) * radius;
        const z = centerZ + (Math.random() * 2 - 1) * radius;
        const clampedX = Math.max(10, Math.min(world.sizeX - 10, x));
        const clampedZ = Math.max(10, Math.min(world.sizeZ - 10, z));
        const y = surfaceYAt(clampedX, clampedZ);
        if (y > 2) return new THREE.Vector3(clampedX, y, clampedZ);
      }
      return randomLandPoint();
    };

    const spawnMob = (kind: MobKind, hostile: boolean, count: number, centerX: number, centerZ: number, radius: number) => {
      for (let i = 0; i < count; i += 1) {
        let model: MobModel;
        let speed = 1;
        let hp = 10;
        let detectRange = 0;
        let attackDamage = 0;
        let attackCooldown = 0;

        if (kind === "sheep") {
          model = createMobModel(0xf5f5f5, 0xd8d8d8, 0xb7b7b7, 0x111111, 0xcecece, [1.05, 0.75, 1.35], [0.58, 0.48, 0.5]);
          speed = 0.9;
          hp = 10;
        } else if (kind === "chicken") {
          model = createMobModel(0xffefba, 0xffe095, 0xe0b970, 0x111111, 0xd28730, [0.52, 0.44, 0.62], [0.3, 0.28, 0.28]);
          speed = 1.2;
          hp = 7;
        } else if (kind === "horse") {
          model = createMobModel(0x8a5d36, 0x74472a, 0x5d3a22, 0x101010, 0x3e2413, [1.45, 1.1, 2.2], [0.56, 0.6, 0.62]);
          speed = 1.4;
          hp = 14;
        } else if (kind === "zombie") {
          model = createMobModel(0x669e57, 0x4e7e45, 0x41663a, 0xff3333, 0x264a2f, [0.78, 1.1, 0.52], [0.52, 0.52, 0.52]);
          speed = 1.05;
          hp = 10;
          detectRange = 11;
          attackDamage = 1;
          attackCooldown = 1.35;
        } else if (kind === "skeleton") {
          model = createMobModel(0xe4e4e2, 0xcfcfcb, 0xb4b4b1, 0xff3333, 0x8f8f8f, [0.75, 1.08, 0.48], [0.48, 0.48, 0.48]);
          speed = 1.08;
          hp = 9;
          detectRange = 12;
          attackDamage = 1;
          attackCooldown = 1.4;
        } else {
          model = createMobModel(0x2e2e2e, 0x1f1f1f, 0x161616, 0xff3333, 0x4a0f0f, [1.15, 0.52, 1.15], [0.5, 0.42, 0.5]);
          speed = 1.2;
          hp = 8;
          detectRange = 10;
          attackDamage = 1;
          attackCooldown = 1.1;
        }

        const spawnPos = randomLandPointNear(centerX, centerZ, radius);
        model.group.position.set(spawnPos.x, spawnPos.y + model.halfHeight, spawnPos.z);
        scene.add(model.group);

        mobs.push({
          kind,
          hostile,
          hp,
          group: model.group,
          legs: model.legs,
          direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
          turnTimer: 1 + Math.random() * 3,
          speed,
          detectRange,
          attackDamage,
          attackCooldown,
          attackTimer: Math.random(),
          halfHeight: model.halfHeight,
          bobSeed: Math.random() * 10
        });

        disposables.push({ materials: model.materials, geometries: model.geometries });
      }
    };

    const spawnCenterX = player.position.x;
    const spawnCenterZ = player.position.z;
    const spawnRadius = RENDER_RADIUS * 0.7;
    spawnMob("sheep", false, 14, spawnCenterX, spawnCenterZ, spawnRadius);
    spawnMob("chicken", false, 12, spawnCenterX, spawnCenterZ, spawnRadius);
    spawnMob("horse", false, 8, spawnCenterX, spawnCenterZ, spawnRadius);
    spawnMob("zombie", true, 8, spawnCenterX, spawnCenterZ, spawnRadius);
    spawnMob("skeleton", true, 6, spawnCenterX, spawnCenterZ, spawnRadius);
    spawnMob("spider", true, 6, spawnCenterX, spawnCenterZ, spawnRadius);

    setPassiveCount(mobs.filter((mob) => !mob.hostile).length);
    setHostileCount(mobs.filter((mob) => mob.hostile).length);

    const updateCamera = () => {
      camera.position.set(player.position.x, player.position.y + EYE_HEIGHT, player.position.z);
      camera.rotation.order = "YXZ";
      camera.rotation.y = controls.yaw;
      camera.rotation.x = controls.pitch;
    };

    const respawn = () => {
      const spawn = randomLandPointNear(world.sizeX / 2, world.sizeZ / 2, RENDER_RADIUS * 0.9);
      player.position.set(spawn.x, spawn.y + 2, spawn.z);
      player.velocity.set(0, 0, 0);
      controls.pitch = 0;
      controls.keys.clear();
      leftMouseHeldRef.current = false;
      mineTargetRef.current = "";
      mineProgressRef.current = 0;
      updateCamera();
    };

    updateCamera();

    const applyDamage = (amount: number) => {
      if (isDeadRef.current) return;
      const v = Math.max(0, Math.floor(amount));
      if (v <= 0) return;
      const next = Math.max(0, heartsRef.current - v);
      heartsRef.current = next;
      setHearts(next);
      if (next <= 0) {
        isDeadRef.current = true;
        respawnTimerRef.current = 3;
        respawnShownRef.current = 3;
        setRespawnSeconds(3);
        controls.keys.clear();
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      }
    };

    let currentRegionX = Number.NaN;
    let currentRegionZ = Number.NaN;

    const rebuildWorldMesh = (force = false) => {
      const regionX = Math.floor(player.position.x / RENDER_GRID) * RENDER_GRID;
      const regionZ = Math.floor(player.position.z / RENDER_GRID) * RENDER_GRID;
      if (!force && regionX === currentRegionX && regionZ === currentRegionZ) return;

      currentRegionX = regionX;
      currentRegionZ = regionZ;

      const geometry = world.buildGeometryRegion(regionX - RENDER_RADIUS, regionX + RENDER_RADIUS, regionZ - RENDER_RADIUS, regionZ + RENDER_RADIUS);
      scene.remove(worldMesh);
      worldMesh.geometry.dispose();
      worldMesh = new THREE.Mesh(geometry, worldMaterial);
      scene.add(worldMesh);
    };

    rebuildWorldMesh(true);

    const persistSave = () => {
      try {
        const inventoryCounts: Record<string, number> = {};
        for (const slot of inventoryRef.current) inventoryCounts[slot.id] = slot.count;
        const changes: Array<[number, number]> = [];
        for (const [idx, block] of changedBlocks.entries()) changes.push([idx, block]);

        const saveData: SaveDataV1 = {
          version: 1,
          seed: world.seed,
          changes,
          inventoryCounts,
          selectedSlot: selectedSlotRef.current,
          player: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z
          }
        };

        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        setSaveMessage("Saved");
        setTimeout(() => setSaveMessage(""), 1200);
      } catch {
        setSaveMessage("Save failed");
        setTimeout(() => setSaveMessage(""), 1200);
      }
    };

    const loadFromSave = () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) {
          setSaveMessage("No save found");
          setTimeout(() => setSaveMessage(""), 1400);
          return;
        }
        setSaveMessage("Loaded");
        setTimeout(() => {
          window.location.reload();
        }, 120);
      } catch {
        setSaveMessage("Load failed");
        setTimeout(() => setSaveMessage(""), 1200);
      }
    };

    saveNowRef.current = persistSave;
    loadNowRef.current = loadFromSave;
    const autoSaveId = window.setInterval(persistSave, 15000);
    const onBeforeUnload = () => persistSave();
    window.addEventListener("beforeunload", onBeforeUnload);

    const rotateByMouse = (movementX: number, movementY: number) => {
      const sensitivity = 0.0021;
      controls.yaw -= movementX * sensitivity;
      controls.pitch -= movementY * sensitivity;
      controls.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, controls.pitch));
    };

    const stepAxis = (axis: "x" | "y" | "z", amount: number) => {
      const stepSize = 0.05 * Math.sign(amount);
      let remaining = amount;
      while (Math.abs(remaining) > 1e-6) {
        const step = Math.abs(remaining) > Math.abs(stepSize) ? stepSize : remaining;
        player.position[axis] += step;
        if (collidesAt(world, player.position, PLAYER_HALF_WIDTH, PLAYER_HEIGHT)) {
          player.position[axis] -= step;
          if (axis === "y" && step < 0) player.onGround = true;
          if (axis === "y") player.velocity.y = 0;
          break;
        }
        remaining -= step;
      }
    };

    const setBlockTracked = (x: number, y: number, z: number, nextBlock: BlockId) => {
      if (!world.inBounds(x, y, z)) return;
      const idx = world.index(x, y, z);
      if (!baselineByIndex.has(idx)) baselineByIndex.set(idx, world.get(x, y, z));
      world.set(x, y, z, nextBlock);
      const baseline = baselineByIndex.get(idx) ?? BlockId.Air;
      if (nextBlock === baseline) changedBlocks.delete(idx);
      else changedBlocks.set(idx, nextBlock);
    };

    const addBlockDrop = (block: BlockId) => {
      const slotId = BLOCK_TO_SLOT[block];
      if (slotId) adjustSlotCount(slotId, 1);
    };

    const tryUseSelectedPlaceable = (): BlockId | null => {
      const slot = inventoryRef.current[selectedSlotRef.current];
      if (!slot || slot.kind !== "block" || slot.count <= 0 || slot.blockId === undefined) return null;
      adjustSlotCount(slot.id, -1);
      return slot.blockId;
    };

    const weaponDamage = (): number => {
      const slot = inventoryRef.current[selectedSlotRef.current];
      if (slot?.kind === "weapon" && slot.count > 0) return slot.attack ?? 8;
      return 6;
    };

    const selectedTool = (): InventorySlot | null => {
      const slot = inventoryRef.current[selectedSlotRef.current];
      if (slot?.kind === "tool" && slot.count > 0) return slot;
      return null;
    };

    const canMineBlock = (block: BlockId): boolean => {
      const toolTier = selectedTool()?.mineTier ?? 0;
      if (block === BlockId.Stone || block === BlockId.Cobblestone || block === BlockId.Brick) return toolTier >= 1;
      if (block === BlockId.SliverOre) return toolTier >= 2;
      if (block === BlockId.RubyOre) return toolTier >= 3;
      return true;
    };

    const miningSpeed = (): number => {
      const tool = selectedTool();
      return tool?.minePower ?? 0.8;
    };

    const removeMobAt = (index: number) => {
      const mob = mobs[index];
      scene.remove(mob.group);
      mobs.splice(index, 1);
      if (mob.hostile) adjustSlotCount("cobble", 1);
      else adjustSlotCount("wood", 1);
    };

    const tryAttackMob = (): boolean => {
      const origin = camera.position;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);

      let bestIndex = -1;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < mobs.length; i += 1) {
        const mob = mobs[i];
        const toMob = mob.group.position.clone().sub(origin);
        const dist = toMob.length();
        if (dist > 4.5) continue;
        toMob.normalize();
        if (forward.dot(toMob) < 0.89) continue;
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }

      if (bestIndex < 0) return false;

      const mob = mobs[bestIndex];
      const damage = weaponDamage();
      mob.hp -= damage;

      const knock = mob.group.position.clone().sub(player.position).setY(0);
      if (knock.lengthSq() > 0.0001) mob.direction.copy(knock.normalize());

      if (mob.hp <= 0) {
        removeMobAt(bestIndex);
        setPassiveCount(mobs.filter((m) => !m.hostile).length);
        setHostileCount(mobs.filter((m) => m.hostile).length);
      }

      return true;
    };

    const doBreakOrPlace = (place: boolean) => {
      raycaster.setFromCamera(pointer, camera);
      const result = voxelRaycast(world, camera.position, raycaster.ray.direction, 7);
      if (!result) return;

      if (place) {
        const tx = result.previous.x;
        const ty = result.previous.y;
        const tz = result.previous.z;
        if (!world.inBounds(tx, ty, tz) || world.get(tx, ty, tz) !== BlockId.Air) return;

        const block = tryUseSelectedPlaceable();
        if (block === null || block === BlockId.Bedrock) return;

        setBlockTracked(tx, ty, tz, block);
        if (collidesAt(world, player.position, PLAYER_HALF_WIDTH, PLAYER_HEIGHT)) {
          setBlockTracked(tx, ty, tz, BlockId.Air);
          const slot = inventoryRef.current[selectedSlotRef.current];
          if (slot) adjustSlotCount(slot.id, 1);
          return;
        }
      }

      rebuildWorldMesh(true);
    };

    const processMining = (dt: number) => {
      if (!leftMouseHeldRef.current || inventoryOpenRef.current || isDeadRef.current) return;
      if (document.pointerLockElement !== renderer.domElement) return;

      raycaster.setFromCamera(pointer, camera);
      const result = voxelRaycast(world, camera.position, raycaster.ray.direction, 7);
      if (!result) {
        mineTargetRef.current = "";
        mineProgressRef.current = 0;
        return;
      }

      const bx = result.hit.x;
      const by = result.hit.y;
      const bz = result.hit.z;
      const targetBlock = world.get(bx, by, bz);
      if (targetBlock === BlockId.Bedrock || targetBlock === BlockId.Air || !canMineBlock(targetBlock as BlockId)) {
        mineTargetRef.current = "";
        mineProgressRef.current = 0;
        return;
      }

      const key = `${bx},${by},${bz}`;
      if (mineTargetRef.current !== key) {
        mineTargetRef.current = key;
        mineProgressRef.current = 0;
      }

      const hardness = BREAK_HARDNESS[targetBlock as BlockId] ?? 2;
      mineProgressRef.current += dt * miningSpeed() * 2.1;
      if (mineProgressRef.current < hardness) return;

      setBlockTracked(bx, by, bz, BlockId.Air);
      addBlockDrop(targetBlock as BlockId);
      rebuildWorldMesh(true);
      mineProgressRef.current = 0;
      mineTargetRef.current = "";
    };

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const onMouseMove = (evt: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) rotateByMouse(evt.movementX, evt.movementY);
    };

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.code.startsWith("Digit")) {
        const idx = Number.parseInt(evt.code.slice(5), 10) - 1;
        if (idx >= 0 && idx < inventoryRef.current.length) setSelectedSlot(idx);
      }

      if (evt.code === "KeyI") {
        setInventoryOpen((prev) => !prev);
        controls.keys.clear();
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
        return;
      }

      if (inventoryOpenRef.current) return;
      if (isDeadRef.current) return;

      if (evt.code === "KeyE") {
        evt.preventDefault();
        doBreakOrPlace(true);
      }

      controls.keys.add(evt.code);
      setCapsActive(evt.getModifierState("CapsLock"));
      if (evt.code === "Space") evt.preventDefault();
    };

    const onKeyUp = (evt: KeyboardEvent) => {
      controls.keys.delete(evt.code);
      setCapsActive(evt.getModifierState("CapsLock"));
    };

    const onMouseDown = (evt: MouseEvent) => {
      if (inventoryOpenRef.current) return;
      if (isDeadRef.current) return;
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
      }

      if (evt.button === 0) {
        leftMouseHeldRef.current = true;
        if (tryAttackMob()) {
          mineTargetRef.current = "";
          mineProgressRef.current = 0;
        }
      }
      if (evt.button === 2) doBreakOrPlace(true);
    };

    const onMouseUp = (evt: MouseEvent) => {
      if (evt.button !== 0) return;
      leftMouseHeldRef.current = false;
      mineTargetRef.current = "";
      mineProgressRef.current = 0;
    };

    const onContextMenu = (evt: MouseEvent) => evt.preventDefault();
    const onPointerLock = () => setLocked(document.pointerLockElement === renderer.domElement);

    window.addEventListener("resize", onResize);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerlockchange", onPointerLock);

    const up = new THREE.Vector3(0, 1, 0);
    const dirForward = new THREE.Vector3();
    const dirRight = new THREE.Vector3();

    let last = performance.now();
    let dayClock = 0;
    let dayHudTimer = 0;
    let voidTimer = 0;

    const tickMobs = (dt: number, time: number) => {
      const deadIndices: number[] = [];

      for (let i = 0; i < mobs.length; i += 1) {
        const mob = mobs[i];
        mob.attackTimer -= dt;
        mob.turnTimer -= dt;

        const toPlayer = player.position.clone().sub(mob.group.position).setY(0);
        const distanceToPlayer = toPlayer.length();

        let moveSpeed = mob.speed;

        if (mob.hostile && distanceToPlayer < mob.detectRange) {
          if (distanceToPlayer > 0.001) mob.direction.lerp(toPlayer.normalize(), 0.2).normalize();
          moveSpeed *= 1.15;
        } else if (!mob.hostile && distanceToPlayer < 4.2) {
          if (distanceToPlayer > 0.001) mob.direction.lerp(toPlayer.normalize().multiplyScalar(-1), 0.2).normalize();
          moveSpeed *= 1.15;
        } else if (mob.turnTimer <= 0) {
          mob.direction.applyAxisAngle(up, (Math.random() - 0.5) * Math.PI).normalize();
          mob.turnTimer = 1.5 + Math.random() * 4;
        }

        let nx = mob.group.position.x + mob.direction.x * moveSpeed * dt;
        let nz = mob.group.position.z + mob.direction.z * moveSpeed * dt;

        if (nx < 2 || nz < 2 || nx > world.sizeX - 2 || nz > world.sizeZ - 2) {
          mob.direction.multiplyScalar(-1);
          nx = mob.group.position.x + mob.direction.x * moveSpeed * dt;
          nz = mob.group.position.z + mob.direction.z * moveSpeed * dt;
          mob.turnTimer = 1;
        }

        const ground = surfaceYAt(nx, nz);
        const bob = Math.sin(time * 0.008 + mob.bobSeed) * 0.04;
        mob.group.position.set(nx, ground + mob.halfHeight + bob, nz);
        mob.group.rotation.y = Math.atan2(mob.direction.x, mob.direction.z);

        const gait = Math.sin(time * 0.015 * moveSpeed + mob.bobSeed) * 0.3;
        if (mob.legs.length === 4) {
          mob.legs[0].rotation.x = gait;
          mob.legs[1].rotation.x = -gait;
          mob.legs[2].rotation.x = -gait;
          mob.legs[3].rotation.x = gait;
        }

        if (mob.hostile && distanceToPlayer < 1.5 && mob.attackTimer <= 0) {
          applyDamage(mob.attackDamage);
          if (!isDeadRef.current && distanceToPlayer > 0.001) {
            const knock = toPlayer.normalize().multiplyScalar(4.2);
            player.velocity.x += knock.x;
            player.velocity.z += knock.z;
            player.velocity.y = Math.max(player.velocity.y, 3.4);
          }
          mob.attackTimer = mob.attackCooldown;
        }

        if (mob.hp <= 0) deadIndices.push(i);
      }

      if (deadIndices.length > 0) {
        for (let i = deadIndices.length - 1; i >= 0; i -= 1) removeMobAt(deadIndices[i]);
        setPassiveCount(mobs.filter((mob) => !mob.hostile).length);
        setHostileCount(mobs.filter((mob) => mob.hostile).length);
      }
    };

    const clock = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (isDeadRef.current) {
        respawnTimerRef.current -= dt;
        const left = Math.max(0, Math.ceil(respawnTimerRef.current));
        if (left !== respawnShownRef.current) {
          respawnShownRef.current = left;
          setRespawnSeconds(left);
        }
        if (respawnTimerRef.current <= 0) {
          heartsRef.current = MAX_HEARTS;
          setHearts(MAX_HEARTS);
          isDeadRef.current = false;
          respawnShownRef.current = 0;
          setRespawnSeconds(0);
          respawn();
        } else {
          tickMobs(dt, now);
          rebuildWorldMesh(false);
          updateCamera();
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(clock);
          return;
        }
      }

      const forwardInput = (controls.keys.has("KeyW") ? 1 : 0) - (controls.keys.has("KeyS") ? 1 : 0);
      const strafeInput = (controls.keys.has("KeyD") ? 1 : 0) - (controls.keys.has("KeyA") ? 1 : 0);
      const wantsJump = controls.keys.has("Space");
      const crouching = controls.keys.has("ShiftLeft") || controls.keys.has("ShiftRight");

      camera.getWorldDirection(dirForward);
      dirForward.y = 0;
      if (dirForward.lengthSq() < 1e-6) dirForward.set(0, 0, -1);
      dirForward.normalize();
      dirRight.crossVectors(dirForward, up).normalize();

      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(dirForward, forwardInput);
      moveDir.addScaledVector(dirRight, strafeInput);
      if (moveDir.lengthSq() > 0) moveDir.normalize();

      const sprinting = forwardInput > 0 && controls.keys.has("KeyW") && capsActiveRef.current && !crouching;
      const speed = crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;

      player.velocity.x = moveDir.x * speed;
      player.velocity.z = moveDir.z * speed;

      const wasGrounded = player.onGround;
      player.velocity.y -= GRAVITY * dt;
      if (wantsJump && player.onGround && !crouching) {
        player.velocity.y = JUMP_VELOCITY;
        player.onGround = false;
      }

      const vyBeforeMove = player.velocity.y;
      const prevX = player.position.x;
      const prevZ = player.position.z;

      player.onGround = false;
      stepAxis("x", player.velocity.x * dt);
      stepAxis("z", player.velocity.z * dt);
      stepAxis("y", player.velocity.y * dt);

      // Crouch edge safety.
      if (crouching && (player.onGround || wasGrounded) && !hasSupportUnderPlayer(world, player.position, PLAYER_HALF_WIDTH)) {
        player.position.x = prevX;
        player.position.z = prevZ;
      }

      // World border clamp.
      player.position.x = Math.min(world.sizeX - 1.2, Math.max(1.2, player.position.x));
      player.position.z = Math.min(world.sizeZ - 1.2, Math.max(1.2, player.position.z));

      if (!wasGrounded && player.onGround && vyBeforeMove < -14) {
        applyDamage(Math.min(18, Math.floor((-vyBeforeMove - 13) * 1.15)));
      }

      const inVoid = player.position.y < -4;
      if (inVoid) {
        voidTimer += dt;
        if (voidTimer >= 0.4) {
          applyDamage(3);
          voidTimer = 0;
        }
      } else {
        voidTimer = 0;
      }

      processMining(dt);
      dayClock += dt;
      const cycleSeconds = 240;
      const phase = (dayClock % cycleSeconds) / cycleSeconds;
      const sunAngle = phase * Math.PI * 2;
      const daylight = Math.max(0.04, Math.sin(sunAngle) * 0.95 + 0.05);

      sun.position.set(Math.cos(sunAngle) * 110, Math.sin(sunAngle) * 108, Math.sin(sunAngle * 0.7) * 80);
      sun.intensity = 0.2 + daylight * 1.2;
      hemiLight.intensity = 0.24 + daylight * 1.05;

      liveSky.copy(nightSky).lerp(daySky, daylight);
      scene.fog?.color.copy(liveSky);

      dayHudTimer += dt;
      if (dayHudTimer >= 0.25) {
        setDaylightPercent(Math.round(daylight * 100));
        dayHudTimer = 0;
      }

      tickMobs(dt, now);
      rebuildWorldMesh(false);
      updateCamera();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(clock);
    };

    let animationFrame = requestAnimationFrame(clock);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearInterval(autoSaveId);
      window.removeEventListener("beforeunload", onBeforeUnload);
      saveNowRef.current = null;
      loadNowRef.current = null;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onPointerLock);
      document.exitPointerLock();

      for (const mob of mobs) scene.remove(mob.group);
      for (const entry of disposables) {
        for (const material of entry.materials) material.dispose();
        for (const geometry of entry.geometries) geometry.dispose();
      }

      scene.remove(worldMesh);
      worldMesh.geometry.dispose();
      worldMaterial.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const selectedSlotData = inventory[selectedSlot];

  return (
    <div className="game-root">
      <div ref={mountRef} className="game-canvas-wrap" />

      <div className="hud">
        <div className="title">Minecraft-ish</div>
        <div className="help">
          <span>{locked ? "Mouse: Look" : "Click to lock mouse"}</span>
          <span>Move: W/S forward-back, A/D strafe</span>
          <span>Sprint: W + CapsLock | Crouch: Shift</span>
          <span>Attack: Left click | Mine: Hold left click | Place: Right click or E</span>
          <span>Stone needs pickaxe, Sliver needs Stone Pickaxe, Ruby needs Sliver Pickaxe</span>
          <span>Inventory/Crafting: I | Hotbar: 1..12</span>
        </div>
        <div className="stats-line">Passive Mobs: {passiveCount} | Hostile Mobs: {hostileCount}</div>
        <div className="stats-line">Daylight: {daylightPercent}%</div>
        <div className="stats-line">Selected: {selectedSlotData?.label ?? "None"}</div>
        <div className="save-controls">
          <button className="save-btn" onClick={() => saveNowRef.current?.()}>
            Save World
          </button>
          <button className="save-btn" onClick={() => loadNowRef.current?.()}>
            Load Save
          </button>
          {saveMessage ? <span className="save-msg">{saveMessage}</span> : null}
        </div>

        <div className="health-wrap">
          <div className="health-label">Health: {hearts} / {MAX_HEARTS} hearts</div>
          <div className="health-bar">
            {heartDisplay.map((filled, idx) => (
              <span key={idx} className={filled ? "heart filled" : "heart"}>
                ♥
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="hotbar-bottom">
        {inventory.map((slot, idx) => (
          <button
            key={slot.id}
            className={idx === selectedSlot ? "hotbar-slot active" : "hotbar-slot"}
            onClick={() => setSelectedSlot(idx)}
          >
            <span className="slot-index">{idx + 1}</span>
            <span className="slot-label">{slot.label}</span>
            <span className="slot-count">{slot.count}</span>
          </button>
        ))}
      </div>

      {inventoryOpen ? (
        <div className="inventory-panel">
          <div className="inventory-title">Inventory & Crafting</div>
          <div className="inventory-grid">
            {inventory.map((slot, idx) => (
              <button
                key={`inv-${slot.id}`}
                className={idx === selectedSlot ? "inventory-slot active" : "inventory-slot"}
                onClick={() => setSelectedSlot(idx)}
              >
                <span>{slot.label}</span>
                <span>x{slot.count}</span>
              </button>
            ))}
          </div>

          <div className="crafting-title">Recipes</div>
          <div className="crafting-list">
            {RECIPES.map((recipe) => (
              <button key={recipe.id} className="craft-btn" onClick={() => craft(recipe)} disabled={!canCraft(recipe)}>
                {recipe.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {respawnSeconds > 0 ? (
        <div className="respawn-overlay">
          <div className="respawn-card">
            <div className="respawn-title">You Died</div>
            <div className="respawn-sub">Respawning in {respawnSeconds}...</div>
          </div>
        </div>
      ) : null}

      <div className="crosshair" />
      <div className={capsActive ? "caps-indicator on" : "caps-indicator"}>CapsLock {capsActive ? "ON (Sprint Enabled)" : "OFF"}</div>
    </div>
  );
}
