"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BlockId, collidesAt, VoxelWorld, voxelRaycast } from "@/lib/world";

const PLAYER_HEIGHT = 1.8;
const PLAYER_HALF_WIDTH = 0.3;
const EYE_HEIGHT = 1.62;
const GRAVITY = 26;
const JUMP_VELOCITY = 8.2;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.4;

const HOTBAR: BlockId[] = [BlockId.Grass, BlockId.Dirt, BlockId.Stone, BlockId.Wood, BlockId.Leaves];
const HOTBAR_LABELS = ["Grass", "Dirt", "Stone", "Wood", "Leaves"];

export default function MinecraftGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const selectedBlockRef = useRef(0);
  const capsActiveRef = useRef(false);
  const [locked, setLocked] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [capsActive, setCapsActive] = useState(false);

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  useEffect(() => {
    capsActiveRef.current = capsActive;
  }, [capsActive]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const world = new VoxelWorld();
    world.generate();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8bc2ff);
    scene.fog = new THREE.Fog(0x8bc2ff, 28, 115);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xc8edff, 0x4f4435, 1.2);
    scene.add(hemiLight);
    const sun = new THREE.DirectionalLight(0xfff2d2, 1.2);
    sun.position.set(40, 90, 20);
    scene.add(sun);

    const worldMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    let worldMesh = new THREE.Mesh(world.buildGeometry(), worldMaterial);
    scene.add(worldMesh);

    const pointer = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();

    const controls = {
      yaw: 0,
      pitch: 0,
      keys: new Set<string>()
    };

    const player = {
      position: new THREE.Vector3(world.sizeX / 2, 25, world.sizeZ / 2),
      velocity: new THREE.Vector3(),
      onGround: false
    };

    const updateCamera = () => {
      camera.position.set(player.position.x, player.position.y + EYE_HEIGHT, player.position.z);
      camera.rotation.order = "YXZ";
      camera.rotation.y = controls.yaw;
      camera.rotation.x = controls.pitch;
    };
    updateCamera();

    let last = performance.now();

    const isCapsLockOn = (evt?: KeyboardEvent) => {
      if (evt) return evt.getModifierState("CapsLock");
      return false;
    };

    const rebuildWorldMesh = () => {
      const nextGeometry = world.buildGeometry();
      scene.remove(worldMesh);
      worldMesh.geometry.dispose();
      worldMesh = new THREE.Mesh(nextGeometry, worldMaterial);
      scene.add(worldMesh);
    };

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

    const doBreakOrPlace = (place: boolean) => {
      raycaster.setFromCamera(pointer, camera);
      const result = voxelRaycast(world, camera.position, raycaster.ray.direction, 7);
      if (!result) return;
      if (!place) {
        world.set(result.hit.x, result.hit.y, result.hit.z, BlockId.Air);
      } else {
        const tx = result.previous.x;
        const ty = result.previous.y;
        const tz = result.previous.z;
        const blockToPlace = HOTBAR[selectedBlockRef.current];
        if (blockToPlace === BlockId.Air) return;
        world.set(tx, ty, tz, blockToPlace);
        if (collidesAt(world, player.position, PLAYER_HALF_WIDTH, PLAYER_HEIGHT)) {
          world.set(tx, ty, tz, BlockId.Air);
          return;
        }
      }
      rebuildWorldMesh();
    };

    const onResize = () => {
      if (!mount) return;
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
        if (idx >= 0 && idx < HOTBAR.length) setSelectedBlock(idx);
      }
      controls.keys.add(evt.code);
      const caps = isCapsLockOn(evt);
      setCapsActive(caps);
      if (evt.code === "Space") evt.preventDefault();
    };

    const onKeyUp = (evt: KeyboardEvent) => {
      controls.keys.delete(evt.code);
      setCapsActive(isCapsLockOn(evt));
    };

    const onMouseDown = (evt: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
      }
      if (evt.button === 0) doBreakOrPlace(false);
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

    const clock = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const forward = (controls.keys.has("KeyW") ? 1 : 0) - (controls.keys.has("KeyS") ? 1 : 0);
      const strafe = (controls.keys.has("KeyD") ? 1 : 0) - (controls.keys.has("KeyA") ? 1 : 0);
      const wantsJump = controls.keys.has("Space");

      const dirForward = new THREE.Vector3(Math.sin(controls.yaw), 0, Math.cos(controls.yaw));
      const dirRight = new THREE.Vector3(dirForward.z, 0, -dirForward.x);
      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(dirForward, forward);
      moveDir.addScaledVector(dirRight, strafe);
      if (moveDir.lengthSq() > 0) moveDir.normalize();

      const sprinting = controls.keys.has("KeyW") && capsActiveRef.current;
      const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
      player.velocity.x = moveDir.x * speed;
      player.velocity.z = moveDir.z * speed;

      player.velocity.y -= GRAVITY * dt;
      if (wantsJump && player.onGround) {
        player.velocity.y = JUMP_VELOCITY;
        player.onGround = false;
      }

      player.onGround = false;
      stepAxis("x", player.velocity.x * dt);
      stepAxis("z", player.velocity.z * dt);
      stepAxis("y", player.velocity.y * dt);

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
      scene.remove(worldMesh);
      worldMesh.geometry.dispose();
      worldMaterial.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="game-root">
      <div ref={mountRef} className="game-canvas-wrap" />
      <div className="hud">
        <div className="title">Minecraft-ish</div>
        <div className="help">
          <span>{locked ? "Mouse: Look" : "Click to lock mouse"}</span>
          <span>Move: WASD</span>
          <span>Jump: Space</span>
          <span>Sprint: W + CapsLock</span>
          <span>Break: Left click</span>
          <span>Place: Right click</span>
          <span>Hotbar: 1-5</span>
        </div>
        <div className="hotbar">
          {HOTBAR_LABELS.map((label, idx) => (
            <button key={label} className={idx === selectedBlock ? "hotbar-item active" : "hotbar-item"} onClick={() => setSelectedBlock(idx)}>
              {idx + 1}. {label}
            </button>
          ))}
        </div>
      </div>
      <div className="crosshair" />
      <div className={capsActive ? "caps-indicator on" : "caps-indicator"}>CapsLock {capsActive ? "ON (Sprint Enabled)" : "OFF"}</div>
    </div>
  );
}
