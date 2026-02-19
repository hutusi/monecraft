"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BlockId, collidesAt, VoxelWorld } from "@/lib/world";
import { readSave } from "@/lib/game/save";
import { tickDayNight } from "@/lib/game/runtime/dayNight";
import { bindGameInput } from "@/lib/game/runtime/input";
import { spawnMobGroup, tickMobs } from "@/lib/game/runtime/mobs";
import { doPlace, processMining, tryAttackMob, weaponDamage } from "@/lib/game/runtime/miningCombat";
import { createPersistenceHandlers } from "@/lib/game/runtime/persistence";
import { tickPlayerMovement } from "@/lib/game/runtime/playerMotion";
import { createSurfaceYAt, randomLandPointNear as pickRandomLandPointNear } from "@/lib/game/runtime/spawn";
import {
  BLOCK_TO_SLOT,
  CROUCH_SPEED,
  EYE_HEIGHT,
  GRAVITY,
  INITIAL_INVENTORY,
  JUMP_VELOCITY,
  MAX_HEARTS,
  PLAYER_HEIGHT,
  PLAYER_HALF_WIDTH,
  RECIPES,
  RENDER_GRID,
  RENDER_RADIUS,
  SAVE_KEY,
  SPRINT_SPEED,
  WALK_SPEED
} from "@/lib/game/config";
import type { InventorySlot, MobEntity, Recipe, SaveDataV1 } from "@/lib/game/types";

export function useMinecraftGame() {
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

    const loadedSave: SaveDataV1 | null = readSave(SAVE_KEY);

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

    const surfaceYAt = createSurfaceYAt(world);
    const randomLandPointNear = (centerX: number, centerZ: number, radius: number) =>
      pickRandomLandPointNear(world, surfaceYAt, centerX, centerZ, radius);

    const spawnCenterX = player.position.x;
    const spawnCenterZ = player.position.z;
    const spawnRadius = RENDER_RADIUS * 0.7;
    spawnMobGroup({ kind: "sheep", hostile: false, count: 14, centerX: spawnCenterX, centerZ: spawnCenterZ, radius: spawnRadius, scene, mobs, disposables, randomLandPointNear });
    spawnMobGroup({ kind: "chicken", hostile: false, count: 12, centerX: spawnCenterX, centerZ: spawnCenterZ, radius: spawnRadius, scene, mobs, disposables, randomLandPointNear });
    spawnMobGroup({ kind: "horse", hostile: false, count: 8, centerX: spawnCenterX, centerZ: spawnCenterZ, radius: spawnRadius, scene, mobs, disposables, randomLandPointNear });
    spawnMobGroup({ kind: "zombie", hostile: true, count: 8, centerX: spawnCenterX, centerZ: spawnCenterZ, radius: spawnRadius, scene, mobs, disposables, randomLandPointNear });
    spawnMobGroup({ kind: "skeleton", hostile: true, count: 6, centerX: spawnCenterX, centerZ: spawnCenterZ, radius: spawnRadius, scene, mobs, disposables, randomLandPointNear });
    spawnMobGroup({ kind: "spider", hostile: true, count: 6, centerX: spawnCenterX, centerZ: spawnCenterZ, radius: spawnRadius, scene, mobs, disposables, randomLandPointNear });

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

    const { persistSave, loadFromSave } = createPersistenceHandlers({
      worldSeed: world.seed,
      changedBlocks,
      inventoryRef,
      selectedSlotRef,
      playerPosition: player.position,
      setSaveMessage
    });

    saveNowRef.current = persistSave;
    loadNowRef.current = loadFromSave;
    const autoSaveId = window.setInterval(persistSave, 15000);
    const onBeforeUnload = () => persistSave();
    window.addEventListener("beforeunload", onBeforeUnload);

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

    const createMiningContext = () => ({
      world,
      camera,
      pointerLockElement: renderer.domElement,
      pointer,
      raycaster,
      playerPosition: player.position,
      playerHeight: PLAYER_HEIGHT,
      playerHalfWidth: PLAYER_HALF_WIDTH,
      selectedSlotRef,
      inventoryRef,
      mineProgressRef,
      mineTargetRef,
      leftMouseHeldRef,
      inventoryOpenRef,
      isDeadRef,
      adjustSlotCount,
      addBlockDrop,
      setBlockTracked,
      rebuildWorldMesh
    });

    const removeMobAt = (index: number) => {
      const mob = mobs[index];
      scene.remove(mob.group);
      mobs.splice(index, 1);
      if (mob.hostile) adjustSlotCount("cobble", 1);
      else adjustSlotCount("wood", 1);
    };

    const placeSelectedBlock = () => doPlace(createMiningContext());

    const unbindInput = bindGameInput({
      mount,
      camera,
      renderer,
      controls,
      inventoryRef,
      inventoryOpenRef,
      isDeadRef,
      leftMouseHeldRef,
      mineTargetRef,
      mineProgressRef,
      setLocked,
      setSelectedSlot,
      setInventoryOpen,
      setCapsActive,
      placeSelectedBlock,
      tryAttackAction: () =>
        tryAttackMob(mobs, camera, player.position, weaponDamage(inventoryRef, selectedSlotRef), (idx) => {
          removeMobAt(idx);
          setPassiveCount(mobs.filter((mob) => !mob.hostile).length);
          setHostileCount(mobs.filter((mob) => mob.hostile).length);
        })
    });

    let last = performance.now();
    let dayClock = 0;
    let dayHudTimer = 0;
    let voidTimer = 0;

    const tickMobsRuntime = (dt: number, time: number) =>
      tickMobs({
        dt,
        time,
        worldSizeX: world.sizeX,
        worldSizeZ: world.sizeZ,
        playerPosition: player.position,
        playerVelocity: player.velocity,
        isDead: isDeadRef.current,
        surfaceYAt,
        mobs,
        applyDamage,
        removeMobAt,
        onCountsChanged: () => {
          setPassiveCount(mobs.filter((mob) => !mob.hostile).length);
          setHostileCount(mobs.filter((mob) => mob.hostile).length);
        }
      });

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
          tickMobsRuntime(dt, now);
          rebuildWorldMesh(false);
          updateCamera();
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(clock);
          return;
        }
      }

      ({ voidTimer } = tickPlayerMovement({
        dt,
        world,
        camera,
        keys: controls.keys,
        capsActive: capsActiveRef.current,
        player,
        stepAxis,
        applyDamage,
        playerHalfWidth: PLAYER_HALF_WIDTH,
        walkSpeed: WALK_SPEED,
        sprintSpeed: SPRINT_SPEED,
        crouchSpeed: CROUCH_SPEED,
        gravity: GRAVITY,
        jumpVelocity: JUMP_VELOCITY,
        worldBorderPadding: 1.2,
        voidTimer
      }));

      processMining(createMiningContext(), dt);
      ({ dayClock, dayHudTimer } = tickDayNight({
        dt,
        dayClock,
        dayHudTimer,
        sun,
        hemiLight,
        daySky,
        nightSky,
        liveSky,
        scene,
        setDaylightPercent
      }));

      tickMobsRuntime(dt, now);
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
      unbindInput();
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

  return {
    mountRef,
    locked,
    selectedSlot,
    setSelectedSlot,
    capsActive,
    inventoryOpen,
    inventory,
    hearts,
    daylightPercent,
    passiveCount,
    hostileCount,
    respawnSeconds,
    saveMessage,
    heartDisplay,
    selectedSlotData,
    recipes: RECIPES,
    maxHearts: MAX_HEARTS,
    canCraft,
    craft,
    saveNow: () => saveNowRef.current?.(),
    loadNow: () => loadNowRef.current?.()
  };
}
