import * as THREE from "three";
import { VoxelWorld } from "@/lib/world";

export type SurfaceYAtFn = (x: number, z: number) => number;

export function createSurfaceYAt(world: VoxelWorld): SurfaceYAtFn {
  return (x: number, z: number) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= world.sizeX || iz >= world.sizeZ) return 1;
    return world.highestSolidY(ix, iz) + 1;
  };
}

export function randomLandPoint(world: VoxelWorld, surfaceYAt: SurfaceYAtFn): THREE.Vector3 {
  for (let i = 0; i < 40; i += 1) {
    const x = 10 + Math.random() * (world.sizeX - 20);
    const z = 10 + Math.random() * (world.sizeZ - 20);
    const y = surfaceYAt(x, z);
    if (y > 2) return new THREE.Vector3(x, y, z);
  }
  return new THREE.Vector3(world.sizeX / 2, 12, world.sizeZ / 2);
}

export function randomLandPointNear(world: VoxelWorld, surfaceYAt: SurfaceYAtFn, centerX: number, centerZ: number, radius: number): THREE.Vector3 {
  for (let i = 0; i < 50; i += 1) {
    const x = centerX + (Math.random() * 2 - 1) * radius;
    const z = centerZ + (Math.random() * 2 - 1) * radius;
    const clampedX = Math.max(10, Math.min(world.sizeX - 10, x));
    const clampedZ = Math.max(10, Math.min(world.sizeZ - 10, z));
    const y = surfaceYAt(clampedX, clampedZ);
    if (y > 2) return new THREE.Vector3(clampedX, y, clampedZ);
  }
  return randomLandPoint(world, surfaceYAt);
}
