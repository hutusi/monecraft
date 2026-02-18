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
  [BlockId.Glass]: 2
};

type InventorySlot = {
  id: string;
  label: string;
  kind: "block" | "weapon";
  count: number;
  blockId?: BlockId;
  attack?: number;
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
  [BlockId.Glass]: "glass"
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

function createMobModel(bodyColor: number, headColor: number, legColor: number, eyeColor: number, bodySize: [number, number, number], headSize: [number, number, number]): MobModel {
  const group = new THREE.Group();
  const materials = [
    new THREE.MeshLambertMaterial({ color: bodyColor }),
    new THREE.MeshLambertMaterial({ color: headColor }),
    new THREE.MeshLambertMaterial({ color: legColor }),
    new THREE.MeshLambertMaterial({ color: eyeColor })
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

  group.add(body, head, eyeL, eyeR);

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

  return { group, legs, halfHeight: Math.max(bodySize[1], legGeo.parameters.height) * 0.5 + 0.2, materials, geometries: [bodyGeo, headGeo, legGeo, eyeGeo] };
}

export default function MinecraftGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const selectedSlotRef = useRef(0);
  const capsActiveRef = useRef(false);
  const inventoryRef = useRef<InventorySlot[]>(INITIAL_INVENTORY);
  const inventoryOpenRef = useRef(false);
  const heartsRef = useRef(MAX_HEARTS);
  const breakProgressRef = useRef<Map<string, number>>(new Map());

  const [locked, setLocked] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [capsActive, setCapsActive] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventory, setInventory] = useState<InventorySlot[]>(INITIAL_INVENTORY);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [daylightPercent, setDaylightPercent] = useState(100);
  const [passiveCount, setPassiveCount] = useState(0);
  const [hostileCount, setHostileCount] = useState(0);

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

    const world = new VoxelWorld();
    world.generate();

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

    const hemiLight = new THREE.HemisphereLight(0xc8edff, 0x4f4435, 1.2);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff2d2, 1.2);
    sun.position.set(40, 95, 24);
    scene.add(sun);

    const worldMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
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

    const spawnMob = (kind: MobKind, hostile: boolean, count: number) => {
      for (let i = 0; i < count; i += 1) {
        let model: MobModel;
        let speed = 1;
        let hp = 10;
        let detectRange = 0;
        let attackDamage = 0;
        let attackCooldown = 0;

        if (kind === "sheep") {
          model = createMobModel(0xf5f5f5, 0xd8d8d8, 0xb7b7b7, 0x111111, [1.05, 0.75, 1.35], [0.58, 0.48, 0.5]);
          speed = 0.9;
          hp = 10;
        } else if (kind === "chicken") {
          model = createMobModel(0xffefba, 0xffe095, 0xe0b970, 0x111111, [0.52, 0.44, 0.62], [0.3, 0.28, 0.28]);
          speed = 1.2;
          hp = 7;
        } else if (kind === "horse") {
          model = createMobModel(0x8a5d36, 0x74472a, 0x5d3a22, 0x101010, [1.45, 1.1, 2.2], [0.56, 0.6, 0.62]);
          speed = 1.4;
          hp = 14;
        } else if (kind === "zombie") {
          model = createMobModel(0x669e57, 0x4e7e45, 0x41663a, 0xff3333, [0.78, 1.1, 0.52], [0.52, 0.52, 0.52]);
          speed = 1.05;
          hp = 10;
          detectRange = 11;
          attackDamage = 1;
          attackCooldown = 1.35;
        } else if (kind === "skeleton") {
          model = createMobModel(0xe4e4e2, 0xcfcfcb, 0xb4b4b1, 0xff3333, [0.75, 1.08, 0.48], [0.48, 0.48, 0.48]);
          speed = 1.08;
          hp = 9;
          detectRange = 12;
          attackDamage = 1;
          attackCooldown = 1.4;
        } else {
          model = createMobModel(0x2e2e2e, 0x1f1f1f, 0x161616, 0xff3333, [1.15, 0.52, 1.15], [0.5, 0.42, 0.5]);
          speed = 1.2;
          hp = 8;
          detectRange = 10;
          attackDamage = 1;
          attackCooldown = 1.1;
        }

        const spawnPos = randomLandPoint();
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

    spawnMob("sheep", false, 14);
    spawnMob("chicken", false, 12);
    spawnMob("horse", false, 8);
    spawnMob("zombie", true, 8);
    spawnMob("skeleton", true, 6);
    spawnMob("spider", true, 6);

    setPassiveCount(mobs.filter((mob) => !mob.hostile).length);
    setHostileCount(mobs.filter((mob) => mob.hostile).length);

    const updateCamera = () => {
      camera.position.set(player.position.x, player.position.y + EYE_HEIGHT, player.position.z);
      camera.rotation.order = "YXZ";
      camera.rotation.y = controls.yaw;
      camera.rotation.x = controls.pitch;
    };

    const respawn = () => {
      const spawn = randomLandPoint();
      player.position.set(spawn.x, spawn.y + 2, spawn.z);
      player.velocity.set(0, 0, 0);
      controls.pitch = 0;
      controls.keys.clear();
      updateCamera();
    };

    updateCamera();

    const applyDamage = (amount: number) => {
      const v = Math.max(0, Math.floor(amount));
      if (v <= 0) return;
      const next = Math.max(0, heartsRef.current - v);
      heartsRef.current = next;
      setHearts(next);
      if (next <= 0) {
        heartsRef.current = MAX_HEARTS;
        setHearts(MAX_HEARTS);
        respawn();
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

      if (!place) {
        const bx = result.hit.x;
        const by = result.hit.y;
        const bz = result.hit.z;
        const targetBlock = world.get(bx, by, bz);
        if (targetBlock === BlockId.Bedrock || targetBlock === BlockId.Air) return;

        const key = `${bx},${by},${bz}`;
        const nextHits = (breakProgressRef.current.get(key) ?? 0) + 1;
        const requiredHits = BREAK_HARDNESS[targetBlock as BlockId] ?? 2;
        if (nextHits < requiredHits) {
          breakProgressRef.current.set(key, nextHits);
          return;
        }
        breakProgressRef.current.delete(key);

        world.set(bx, by, bz, BlockId.Air);
        addBlockDrop(targetBlock as BlockId);
      } else {
        const tx = result.previous.x;
        const ty = result.previous.y;
        const tz = result.previous.z;
        if (!world.inBounds(tx, ty, tz) || world.get(tx, ty, tz) !== BlockId.Air) return;

        const block = tryUseSelectedPlaceable();
        if (block === null || block === BlockId.Bedrock) return;

        world.set(tx, ty, tz, block);
        if (collidesAt(world, player.position, PLAYER_HALF_WIDTH, PLAYER_HEIGHT)) {
          world.set(tx, ty, tz, BlockId.Air);
          const slot = inventoryRef.current[selectedSlotRef.current];
          if (slot) adjustSlotCount(slot.id, 1);
          return;
        }
      }

      rebuildWorldMesh(true);
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
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
      }

      if (evt.button === 0) {
        if (!tryAttackMob()) doBreakOrPlace(false);
      }
      if (evt.button === 2) doBreakOrPlace(true);
    };

    const onContextMenu = (evt: MouseEvent) => evt.preventDefault();
    const onPointerLock = () => setLocked(document.pointerLockElement === renderer.domElement);

    window.addEventListener("resize", onResize);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousedown", onMouseDown);
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
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousedown", onMouseDown);
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
          <span>Attack: Left click | Place: Right click or E</span>
          <span>Blocks now need multiple hits to break</span>
          <span>Inventory/Crafting: I | Hotbar: 1..12</span>
        </div>
        <div className="stats-line">Passive Mobs: {passiveCount} | Hostile Mobs: {hostileCount}</div>
        <div className="stats-line">Daylight: {daylightPercent}%</div>
        <div className="stats-line">Selected: {selectedSlotData?.label ?? "None"}</div>

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

      <div className="crosshair" />
      <div className={capsActive ? "caps-indicator on" : "caps-indicator"}>CapsLock {capsActive ? "ON (Sprint Enabled)" : "OFF"}</div>
    </div>
  );
}
