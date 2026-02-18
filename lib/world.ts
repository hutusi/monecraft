import * as THREE from "three";

export const WORLD_SIZE_X = 64;
export const WORLD_SIZE_Y = 40;
export const WORLD_SIZE_Z = 64;

export const enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Wood = 4,
  Leaves = 5
}

const BLOCK_COLORS: Record<number, [number, number, number]> = {
  [BlockId.Grass]: [0.35, 0.68, 0.22],
  [BlockId.Dirt]: [0.46, 0.33, 0.2],
  [BlockId.Stone]: [0.54, 0.56, 0.58],
  [BlockId.Wood]: [0.51, 0.37, 0.19],
  [BlockId.Leaves]: [0.22, 0.5, 0.2]
};

const FACE_DEFS: {
  dir: [number, number, number];
  corners: [number, number, number][];
}[] = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
];

function hash2D(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export class VoxelWorld {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly blocks: Uint8Array;

  constructor(sizeX = WORLD_SIZE_X, sizeY = WORLD_SIZE_Y, sizeZ = WORLD_SIZE_Z) {
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;
    this.blocks = new Uint8Array(sizeX * sizeY * sizeZ);
  }

  index(x: number, y: number, z: number): number {
    return x + z * this.sizeX + y * this.sizeX * this.sizeZ;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sizeX && y < this.sizeY && z < this.sizeZ;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return BlockId.Air;
    return this.blocks[this.index(x, y, z)];
  }

  set(x: number, y: number, z: number, block: BlockId): void {
    if (!this.inBounds(x, y, z)) return;
    this.blocks[this.index(x, y, z)] = block;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) !== BlockId.Air;
  }

  generate(): void {
    for (let x = 0; x < this.sizeX; x += 1) {
      for (let z = 0; z < this.sizeZ; z += 1) {
        const nA = Math.sin(x * 0.12) * 2.2 + Math.cos(z * 0.1) * 2;
        const nB = (hash2D(x, z) - 0.5) * 2.5;
        const height = Math.max(4, Math.min(this.sizeY - 6, Math.floor(12 + nA + nB)));
        for (let y = 0; y <= height; y += 1) {
          if (y === height) this.set(x, y, z, BlockId.Grass);
          else if (y > height - 3) this.set(x, y, z, BlockId.Dirt);
          else this.set(x, y, z, BlockId.Stone);
        }
      }
    }

    for (let x = 3; x < this.sizeX - 3; x += 1) {
      for (let z = 3; z < this.sizeZ - 3; z += 1) {
        if (hash2D(x * 0.5, z * 0.5) < 0.985) continue;
        let topY = this.sizeY - 1;
        while (topY > 1 && this.get(x, topY, z) === BlockId.Air) topY -= 1;
        if (this.get(x, topY, z) !== BlockId.Grass) continue;
        const trunkHeight = 3 + Math.floor(hash2D(x, z) * 3);
        for (let y = 1; y <= trunkHeight; y += 1) this.set(x, topY + y, z, BlockId.Wood);

        const leafStart = topY + trunkHeight - 1;
        for (let ox = -2; ox <= 2; ox += 1) {
          for (let oz = -2; oz <= 2; oz += 1) {
            for (let oy = 0; oy <= 2; oy += 1) {
              const d = Math.abs(ox) + Math.abs(oz) + oy;
              if (d > 4) continue;
              this.set(x + ox, leafStart + oy, z + oz, BlockId.Leaves);
            }
          }
        }
      }
    }
  }

  buildGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const pushVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number, color: [number, number, number]) => {
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      colors.push(color[0], color[1], color[2]);
    };

    for (let y = 0; y < this.sizeY; y += 1) {
      for (let z = 0; z < this.sizeZ; z += 1) {
        for (let x = 0; x < this.sizeX; x += 1) {
          const block = this.get(x, y, z);
          if (block === BlockId.Air) continue;
          const c = BLOCK_COLORS[block] ?? [1, 0, 1];
          for (const face of FACE_DEFS) {
            const nx = face.dir[0];
            const ny = face.dir[1];
            const nz = face.dir[2];
            if (this.isSolid(x + nx, y + ny, z + nz)) continue;
            const a = face.corners[0];
            const b = face.corners[1];
            const c1 = face.corners[2];
            const d = face.corners[3];

            pushVertex(x + a[0], y + a[1], z + a[2], nx, ny, nz, c);
            pushVertex(x + b[0], y + b[1], z + b[2], nx, ny, nz, c);
            pushVertex(x + c1[0], y + c1[1], z + c1[2], nx, ny, nz, c);
            pushVertex(x + a[0], y + a[1], z + a[2], nx, ny, nz, c);
            pushVertex(x + c1[0], y + c1[1], z + c1[2], nx, ny, nz, c);
            pushVertex(x + d[0], y + d[1], z + d[2], nx, ny, nz, c);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export type RaycastResult = {
  hit: THREE.Vector3;
  previous: THREE.Vector3;
};

export function voxelRaycast(
  world: VoxelWorld,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDist = 6
): RaycastResult | null {
  const dir = direction.clone().normalize();
  const pos = origin.clone();

  let x = Math.floor(pos.x);
  let y = Math.floor(pos.y);
  let z = Math.floor(pos.z);

  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;

  const invDx = Math.abs(1 / (dir.x || 1e-6));
  const invDy = Math.abs(1 / (dir.y || 1e-6));
  const invDz = Math.abs(1 / (dir.z || 1e-6));

  let tMaxX = ((stepX > 0 ? x + 1 : x) - pos.x) / (dir.x || 1e-6);
  let tMaxY = ((stepY > 0 ? y + 1 : y) - pos.y) / (dir.y || 1e-6);
  let tMaxZ = ((stepZ > 0 ? z + 1 : z) - pos.z) / (dir.z || 1e-6);
  if (tMaxX < 0) tMaxX += invDx;
  if (tMaxY < 0) tMaxY += invDy;
  if (tMaxZ < 0) tMaxZ += invDz;

  let t = 0;
  let previous = new THREE.Vector3(x, y, z);

  while (t <= maxDist) {
    if (world.isSolid(x, y, z)) {
      return { hit: new THREE.Vector3(x, y, z), previous };
    }
    previous = new THREE.Vector3(x, y, z);
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += invDx;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += invDz;
      }
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += invDy;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += invDz;
    }
  }
  return null;
}

export function collidesAt(world: VoxelWorld, position: THREE.Vector3, halfWidth: number, height: number): boolean {
  const minX = Math.floor(position.x - halfWidth);
  const maxX = Math.floor(position.x + halfWidth);
  const minZ = Math.floor(position.z - halfWidth);
  const maxZ = Math.floor(position.z + halfWidth);
  const minY = Math.floor(position.y);
  const maxY = Math.floor(position.y + height);

  for (let y = minY; y <= maxY; y += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (world.isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}
