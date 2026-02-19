import * as THREE from "three";
import { hasSupportUnderPlayer, VoxelWorld } from "@/lib/world";

type PlayerState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onGround: boolean;
};

type MoveTickArgs = {
  dt: number;
  world: VoxelWorld;
  camera: THREE.PerspectiveCamera;
  keys: Set<string>;
  capsActive: boolean;
  player: PlayerState;
  stepAxis: (axis: "x" | "y" | "z", amount: number) => void;
  applyDamage: (amount: number) => void;
  playerHalfWidth: number;
  walkSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  gravity: number;
  jumpVelocity: number;
  worldBorderPadding: number;
  voidTimer: number;
};

export function tickPlayerMovement(args: MoveTickArgs): { voidTimer: number } {
  const {
    dt,
    world,
    camera,
    keys,
    capsActive,
    player,
    stepAxis,
    applyDamage,
    playerHalfWidth,
    walkSpeed,
    sprintSpeed,
    crouchSpeed,
    gravity,
    jumpVelocity,
    worldBorderPadding
  } = args;
  let { voidTimer } = args;

  const forwardInput = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  const strafeInput = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const wantsJump = keys.has("Space");
  const crouching = keys.has("ShiftLeft") || keys.has("ShiftRight");

  const up = new THREE.Vector3(0, 1, 0);
  const dirForward = new THREE.Vector3();
  const dirRight = new THREE.Vector3();
  const moveDir = new THREE.Vector3();

  camera.getWorldDirection(dirForward);
  dirForward.y = 0;
  if (dirForward.lengthSq() < 1e-6) dirForward.set(0, 0, -1);
  dirForward.normalize();
  dirRight.crossVectors(dirForward, up).normalize();

  moveDir.addScaledVector(dirForward, forwardInput);
  moveDir.addScaledVector(dirRight, strafeInput);
  if (moveDir.lengthSq() > 0) moveDir.normalize();

  const sprinting = forwardInput > 0 && keys.has("KeyW") && capsActive && !crouching;
  const speed = crouching ? crouchSpeed : sprinting ? sprintSpeed : walkSpeed;

  player.velocity.x = moveDir.x * speed;
  player.velocity.z = moveDir.z * speed;

  const wasGrounded = player.onGround;
  player.velocity.y -= gravity * dt;
  if (wantsJump && player.onGround && !crouching) {
    player.velocity.y = jumpVelocity;
    player.onGround = false;
  }

  const vyBeforeMove = player.velocity.y;
  const prevX = player.position.x;
  const prevZ = player.position.z;

  player.onGround = false;
  stepAxis("x", player.velocity.x * dt);
  stepAxis("z", player.velocity.z * dt);
  stepAxis("y", player.velocity.y * dt);

  if (crouching && (player.onGround || wasGrounded) && !hasSupportUnderPlayer(world, player.position, playerHalfWidth)) {
    player.position.x = prevX;
    player.position.z = prevZ;
  }

  player.position.x = Math.min(world.sizeX - worldBorderPadding, Math.max(worldBorderPadding, player.position.x));
  player.position.z = Math.min(world.sizeZ - worldBorderPadding, Math.max(worldBorderPadding, player.position.z));

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

  return { voidTimer };
}
