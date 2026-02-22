import * as THREE from "three";

export const WORLD_SIZE_X = 2000;
export const WORLD_SIZE_Y = 100;
export const WORLD_SIZE_Z = 2000;

export const enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Wood = 4,
  Leaves = 5,
  Bedrock = 6,
  Planks = 7,
  Cobblestone = 8,
  Sand = 9,
  Brick = 10,
  Glass = 11,
  SliverOre = 12,
  RubyOre = 13,
  GoldOre = 14
}

const BLOCK_COLORS: Record<number, [number, number, number]> = {
  [BlockId.Grass]: [0.35, 0.68, 0.22],
  [BlockId.Dirt]: [0.46, 0.33, 0.2],
  [BlockId.Stone]: [0.54, 0.56, 0.58],
  [BlockId.Wood]: [0.51, 0.37, 0.19],
  [BlockId.Leaves]: [0.22, 0.5, 0.2],
  [BlockId.Bedrock]: [0.14, 0.14, 0.14],
  [BlockId.Planks]: [0.76, 0.61, 0.38],
  [BlockId.Cobblestone]: [0.42, 0.43, 0.45],
  [BlockId.Sand]: [0.86, 0.8, 0.5],
  [BlockId.Brick]: [0.68, 0.28, 0.2],
  [BlockId.Glass]: [0.73, 0.9, 0.95],
  [BlockId.SliverOre]: [0.54, 0.56, 0.58],
  [BlockId.RubyOre]: [0.54, 0.56, 0.58],
  [BlockId.GoldOre]: [0.54, 0.56, 0.58]
};

const ATLAS_TILE_SIZE = 16;
const ATLAS_FACE_VARIANTS = 3; // top, side, bottom
const ATLAS_COLUMNS = 16;
let atlasTextureCache: THREE.CanvasTexture | null = null;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function tone(c: [number, number, number], mul: number, add = 0): [number, number, number] {
  return [clamp01(c[0] * mul + add), clamp01(c[1] * mul + add), clamp01(c[2] * mul + add)];
}

function rgb(c: [number, number, number]): string {
  return `rgb(${Math.floor(clamp01(c[0]) * 255)}, ${Math.floor(clamp01(c[1]) * 255)}, ${Math.floor(clamp01(c[2]) * 255)})`;
}

function tileIndexFor(block: number, face: "top" | "side" | "bottom"): number {
  const faceId = face === "top" ? 0 : face === "side" ? 1 : 2;
  return block * ATLAS_FACE_VARIANTS + faceId;
}

export function createBlockAtlasTexture(): THREE.CanvasTexture {
  if (atlasTextureCache) return atlasTextureCache;

  const totalTiles = (BlockId.GoldOre + 1) * ATLAS_FACE_VARIANTS;
  const rows = Math.ceil(totalTiles / ATLAS_COLUMNS);
  const width = ATLAS_COLUMNS * ATLAS_TILE_SIZE;
  const height = rows * ATLAS_TILE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create atlas context");
  ctx.imageSmoothingEnabled = false;

  const drawTile = (block: number, face: "top" | "side" | "bottom") => {
    const tile = tileIndexFor(block, face);
    const col = tile % ATLAS_COLUMNS;
    const row = Math.floor(tile / ATLAS_COLUMNS);
    const ox = col * ATLAS_TILE_SIZE;
    const oy = row * ATLAS_TILE_SIZE;

    const baseBlockColor = BLOCK_COLORS[block] ?? [1, 0, 1];
    let base = baseBlockColor;
    if (face === "top") base = tone(base, 1.08);
    if (face === "bottom") base = tone(base, 0.96);
    if (block === BlockId.Grass && face === "bottom") base = BLOCK_COLORS[BlockId.Dirt];

    for (let y = 0; y < ATLAS_TILE_SIZE; y += 1) {
      for (let x = 0; x < ATLAS_TILE_SIZE; x += 1) {
        const h = Math.sin((x + block * 13 + (face === "top" ? 7 : face === "side" ? 17 : 29)) * 12.1 + (y + block * 19) * 7.7) * 43758.5453;
        const n = h - Math.floor(h);
        let c = tone(base, 0.92 + n * 0.22);

        if (block === BlockId.Grass && face === "side" && y < 4) c = tone(BLOCK_COLORS[BlockId.Grass], 0.95 + n * 0.15);
        if ((block === BlockId.Stone || block === BlockId.Cobblestone || block === BlockId.Bedrock) && n > 0.8) c = tone(base, 1.18);
        if ((block === BlockId.Wood || block === BlockId.Planks) && ((x + y) % 4 === 0)) c = tone(base, 0.82);
        if (block === BlockId.SliverOre && n > 0.86) c = tone([0.93, 0.93, 0.95], 1);
        if (block === BlockId.RubyOre && n > 0.88) c = tone([0.86, 0.24, 0.24], 1);
        if (block === BlockId.GoldOre && n > 0.84) c = tone([0.96, 0.8, 0.25], 1);
        if (block === BlockId.Sand && n > 0.84) c = tone(base, 1.12);

        ctx.fillStyle = rgb(c);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  };

  for (let block = BlockId.Grass; block <= BlockId.GoldOre; block += 1) {
    drawTile(block, "top");
    drawTile(block, "side");
    drawTile(block, "bottom");
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipMapNearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.needsUpdate = true;
  atlasTextureCache = texture;
  return texture;
}

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
  readonly seed: number;
  readonly blocks: Uint8Array;

  constructor(sizeX = WORLD_SIZE_X, sizeY = WORLD_SIZE_Y, sizeZ = WORLD_SIZE_Z, seed = 1337) {
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;
    this.seed = seed;
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

  highestSolidY(x: number, z: number): number {
    for (let y = this.sizeY - 1; y >= 0; y -= 1) {
      if (this.isSolid(x, y, z)) return y;
    }
    return 0;
  }

  private placeHouse(cx: number, cz: number): void {
    const half = 3;
    const floorY = this.highestSolidY(cx, cz) + 1;
    if (floorY < 3 || floorY + 6 >= this.sizeY - 1) return;

    for (let x = cx - half - 1; x <= cx + half + 1; x += 1) {
      for (let z = cz - half - 1; z <= cz + half + 1; z += 1) {
        if (!this.inBounds(x, floorY - 1, z)) return;
        const y = this.highestSolidY(x, z);
        if (Math.abs(y - (floorY - 1)) > 1) return;
      }
    }

    for (let x = cx - half; x <= cx + half; x += 1) {
      for (let z = cz - half; z <= cz + half; z += 1) this.set(x, floorY - 1, z, BlockId.Cobblestone);
    }

    for (let y = floorY; y <= floorY + 3; y += 1) {
      for (let x = cx - half; x <= cx + half; x += 1) {
        for (let z = cz - half; z <= cz + half; z += 1) {
          const wall = x === cx - half || x === cx + half || z === cz - half || z === cz + half;
          if (!wall) continue;
          const isWindow = y === floorY + 1 && ((x === cx && (z === cz - half || z === cz + half)) || (z === cz && (x === cx - half || x === cx + half)));
          this.set(x, y, z, isWindow ? BlockId.Glass : BlockId.Brick);
        }
      }
    }

    this.set(cx, floorY + 1, cz - half, BlockId.Air);
    this.set(cx, floorY + 2, cz - half, BlockId.Air);

    for (let y = floorY; y <= floorY + 3; y += 1) {
      this.set(cx - half, y, cz - half, BlockId.Wood);
      this.set(cx + half, y, cz - half, BlockId.Wood);
      this.set(cx - half, y, cz + half, BlockId.Wood);
      this.set(cx + half, y, cz + half, BlockId.Wood);
    }

    for (let x = cx - half - 1; x <= cx + half + 1; x += 1) {
      for (let z = cz - half - 1; z <= cz + half + 1; z += 1) this.set(x, floorY + 4, z, BlockId.Planks);
    }
  }

  generate(): void {
    const seededHash = (x: number, z: number): number => hash2D(x + this.seed * 0.013, z - this.seed * 0.017);
    const rand = (() => {
      let t = (this.seed >>> 0) + 0x6d2b79f5;
      return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    })();

    const maxX = this.sizeX - 1;
    const maxZ = this.sizeZ - 1;

    for (let x = 0; x < this.sizeX; x += 1) {
      for (let z = 0; z < this.sizeZ; z += 1) this.set(x, 0, z, BlockId.Bedrock);
    }

    for (let x = 0; x < this.sizeX; x += 1) {
      for (let z = 0; z < this.sizeZ; z += 1) {
        // True flat plains at high altitude so the world has meaningful vertical depth.
        const baseHeight = 52;
        const hillMask = Math.max(0, seededHash(x * 0.03 + 137, z * 0.03 - 61) - 0.76);
        const hills = hillMask * 7;
        const mountainMask = Math.max(0, seededHash(x * 0.006 - 29, z * 0.006 + 17) - 0.94);
        const mountains = mountainMask * mountainMask * 22;
        const height = Math.max(14, Math.min(this.sizeY - 8, Math.floor(baseHeight + hills + mountains)));

        const sandy = seededHash(x * 0.12, z * 0.12) > 0.84;

        for (let y = 1; y <= height; y += 1) {
          if (y === height) this.set(x, y, z, sandy ? BlockId.Sand : BlockId.Grass);
          else if (y > height - 3) this.set(x, y, z, BlockId.Dirt);
          else if (y > height - 6 && seededHash(x * 0.33 + y, z * 0.29) > 0.9) this.set(x, y, z, BlockId.Cobblestone);
          else this.set(x, y, z, BlockId.Stone);
        }
      }
    }

    // Unbreakable border walls.
    for (let y = 1; y <= 14; y += 1) {
      for (let x = 0; x < this.sizeX; x += 1) {
        this.set(x, y, 0, BlockId.Bedrock);
        this.set(x, y, maxZ, BlockId.Bedrock);
      }
      for (let z = 0; z < this.sizeZ; z += 1) {
        this.set(0, y, z, BlockId.Bedrock);
        this.set(maxX, y, z, BlockId.Bedrock);
      }
    }

    const carveSphere = (cx: number, cy: number, cz: number, radius: number) => {
      const r2 = radius * radius;
      const minX = Math.max(1, Math.floor(cx - radius));
      const maxXc = Math.min(this.sizeX - 2, Math.ceil(cx + radius));
      const minY = Math.max(1, Math.floor(cy - radius));
      const maxYc = Math.min(this.sizeY - 2, Math.ceil(cy + radius));
      const minZ = Math.max(1, Math.floor(cz - radius));
      const maxZc = Math.min(this.sizeZ - 2, Math.ceil(cz + radius));
      for (let y = minY; y <= maxYc; y += 1) {
        for (let z = minZ; z <= maxZc; z += 1) {
          for (let x = minX; x <= maxXc; x += 1) {
            const dx = x - cx;
            const dy = y - cy;
            const dz = z - cz;
            if (dx * dx + dy * dy + dz * dz > r2) continue;
            const block = this.get(x, y, z);
            if (block !== BlockId.Bedrock) this.set(x, y, z, BlockId.Air);
          }
        }
      }
    };

    // Cave tunnels.
    const caveCount = 780;
    for (let i = 0; i < caveCount; i += 1) {
      let x = 12 + rand() * (this.sizeX - 24);
      let y = 3 + rand() * (this.sizeY - 9);
      let z = 12 + rand() * (this.sizeZ - 24);
      let yaw = rand() * Math.PI * 2;
      let pitch = (rand() - 0.5) * 0.26;
      const length = 70 + Math.floor(rand() * 95);
      for (let step = 0; step < length; step += 1) {
        const r = 1.2 + rand() * 1.7;
        carveSphere(x, y, z, r);
        if (rand() > 0.985) carveSphere(x, y, z, 3 + rand() * 2.8);
        yaw += (rand() - 0.5) * 0.28;
        pitch = Math.max(-0.55, Math.min(0.55, pitch + (rand() - 0.5) * 0.16));
        x += Math.cos(yaw);
        z += Math.sin(yaw);
        y += Math.sin(pitch) * 0.8;
        if (x < 8 || x > this.sizeX - 8 || z < 8 || z > this.sizeZ - 8 || y < 2 || y > this.sizeY - 4) break;
      }
    }

    // Extra cave chambers for wider underground spaces.
    const chamberCount = 260;
    for (let i = 0; i < chamberCount; i += 1) {
      const cx = 12 + rand() * (this.sizeX - 24);
      const cy = 5 + rand() * (this.sizeY - 14);
      const cz = 12 + rand() * (this.sizeZ - 24);
      carveSphere(cx, cy, cz, 3 + rand() * 4.2);
    }

    const hasNearbyAir = (x: number, y: number, z: number): boolean => {
      return (
        this.get(x + 1, y, z) === BlockId.Air ||
        this.get(x - 1, y, z) === BlockId.Air ||
        this.get(x, y + 1, z) === BlockId.Air ||
        this.get(x, y - 1, z) === BlockId.Air ||
        this.get(x, y, z + 1) === BlockId.Air ||
        this.get(x, y, z - 1) === BlockId.Air
      );
    };

    const placeOreVein = (x: number, y: number, z: number, ore: BlockId, minSize: number, maxSize: number) => {
      const size = minSize + Math.floor(rand() * Math.max(1, maxSize - minSize + 1));
      for (let i = 0; i < size; i += 1) {
        const vx = x + Math.floor((rand() - 0.5) * 4);
        const vy = y + Math.floor((rand() - 0.5) * 3);
        const vz = z + Math.floor((rand() - 0.5) * 4);
        if (!this.inBounds(vx, vy, vz) || vy <= 1) continue;
        const b = this.get(vx, vy, vz);
        if (b === BlockId.Stone || b === BlockId.Cobblestone) this.set(vx, vy, vz, ore);
      }
    };

    // Sliver ore in caves (mid depth) - very common.
    for (let i = 0; i < 320000; i += 1) {
      const x = 8 + Math.floor(rand() * (this.sizeX - 16));
      const y = 3 + Math.floor(rand() * Math.max(4, this.sizeY - 10));
      const z = 8 + Math.floor(rand() * (this.sizeZ - 16));
      const block = this.get(x, y, z);
      if ((block !== BlockId.Stone && block !== BlockId.Cobblestone) || !hasNearbyAir(x, y, z)) continue;
      placeOreVein(x, y, z, BlockId.SliverOre, 2, 8);
    }

    // Ruby ore deeper and still rarer than sliver, but more frequent than before.
    for (let i = 0; i < 70000; i += 1) {
      const x = 8 + Math.floor(rand() * (this.sizeX - 16));
      const y = 2 + Math.floor(rand() * Math.max(2, this.sizeY - 16));
      const z = 8 + Math.floor(rand() * (this.sizeZ - 16));
      const block = this.get(x, y, z);
      if ((block !== BlockId.Stone && block !== BlockId.Cobblestone) || !hasNearbyAir(x, y, z)) continue;
      placeOreVein(x, y, z, BlockId.RubyOre, 2, 8);
    }

    // Gold ore, best tier, deep and a bit rarer than ruby.
    for (let i = 0; i < 52000; i += 1) {
      const x = 8 + Math.floor(rand() * (this.sizeX - 16));
      const y = 2 + Math.floor(rand() * Math.max(2, this.sizeY - 22));
      const z = 8 + Math.floor(rand() * (this.sizeZ - 16));
      const block = this.get(x, y, z);
      if ((block !== BlockId.Stone && block !== BlockId.Cobblestone) || !hasNearbyAir(x, y, z)) continue;
      placeOreVein(x, y, z, BlockId.GoldOre, 2, 8);
    }

    const treeCount = 3800;
    for (let i = 0; i < treeCount; i += 1) {
      const x = 4 + Math.floor(rand() * (this.sizeX - 8));
      const z = 4 + Math.floor(rand() * (this.sizeZ - 8));
      const topY = this.highestSolidY(x, z);
      if (this.get(x, topY, z) !== BlockId.Grass) continue;

      const trunkHeight = 3 + Math.floor(rand() * 3);
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

    for (let i = 0; i < 240; i += 1) {
      const cx = 12 + Math.floor(rand() * (this.sizeX - 24));
      const cz = 12 + Math.floor(rand() * (this.sizeZ - 24));
      this.placeHouse(cx, cz);
    }
  }

  buildGeometryRegion(minX: number, maxX: number, minZ: number, maxZ: number, minY = 0, maxY = this.sizeY - 1): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    const clampedMinX = Math.max(0, minX);
    const clampedMaxX = Math.min(this.sizeX - 1, maxX);
    const clampedMinZ = Math.max(0, minZ);
    const clampedMaxZ = Math.min(this.sizeZ - 1, maxZ);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxY = Math.min(this.sizeY - 1, maxY);

    const pushVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number, color: [number, number, number], u: number, v: number) => {
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      colors.push(color[0], color[1], color[2]);
      uvs.push(u, v);
    };
    const materialTint = (ny: number): [number, number, number] => {
      const shade = ny > 0 ? 1 : ny < 0 ? 0.95 : 0.9;
      return [shade, shade, shade];
    };

    const tileUV = (block: number, ny: number): [number, number, number, number] => {
      const face = ny > 0 ? "top" : ny < 0 ? "bottom" : "side";
      const tile = tileIndexFor(block, face);
      const col = tile % ATLAS_COLUMNS;
      const row = Math.floor(tile / ATLAS_COLUMNS);
      const rows = Math.ceil(((BlockId.GoldOre + 1) * ATLAS_FACE_VARIANTS) / ATLAS_COLUMNS);
      const pad = 0.0008;
      const u0 = col / ATLAS_COLUMNS + pad;
      const v0 = row / rows + pad;
      const u1 = (col + 1) / ATLAS_COLUMNS - pad;
      const v1 = (row + 1) / rows - pad;
      return [u0, v0, u1, v1];
    };

    const faceOcclusion = (x: number, y: number, z: number, nx: number, ny: number, nz: number): number => {
      const ax = nz;
      const ay = 0;
      const az = -nx;
      const bx = 0;
      const by = 1;
      const bz = 0;

      const sx = x + nx;
      const sy = y + ny;
      const sz = z + nz;

      let occ = 0;
      if (this.isSolid(sx + ax, sy + ay, sz + az)) occ += 1;
      if (this.isSolid(sx - ax, sy - ay, sz - az)) occ += 1;
      if (this.isSolid(sx + bx, sy + by, sz + bz)) occ += 1;
      if (this.isSolid(sx - bx, sy - by, sz - bz)) occ += 1;
      return Math.max(0.8, 1 - occ * 0.06);
    };

    for (let y = clampedMinY; y <= clampedMaxY; y += 1) {
      for (let z = clampedMinZ; z <= clampedMaxZ; z += 1) {
        for (let x = clampedMinX; x <= clampedMaxX; x += 1) {
          const block = this.get(x, y, z);
          if (block === BlockId.Air) continue;
          for (const face of FACE_DEFS) {
            const nx = face.dir[0];
            const ny = face.dir[1];
            const nz = face.dir[2];
            if (this.isSolid(x + nx, y + ny, z + nz)) continue;

            const base = materialTint(ny);
            const ao = faceOcclusion(x, y, z, nx, ny, nz);
            const color: [number, number, number] = [base[0] * ao, base[1] * ao, base[2] * ao];
            const [u0, v0, u1, v1] = tileUV(block, ny);

            const a = face.corners[0];
            const b = face.corners[1];
            const c = face.corners[2];
            const d = face.corners[3];

            pushVertex(x + a[0], y + a[1], z + a[2], nx, ny, nz, color, u0, v1);
            pushVertex(x + b[0], y + b[1], z + b[2], nx, ny, nz, color, u0, v0);
            pushVertex(x + c[0], y + c[1], z + c[2], nx, ny, nz, color, u1, v0);
            pushVertex(x + a[0], y + a[1], z + a[2], nx, ny, nz, color, u0, v1);
            pushVertex(x + c[0], y + c[1], z + c[2], nx, ny, nz, color, u1, v0);
            pushVertex(x + d[0], y + d[1], z + d[2], nx, ny, nz, color, u1, v1);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
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
    if (world.isSolid(x, y, z)) return { hit: new THREE.Vector3(x, y, z), previous };
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

export function hasSupportUnderPlayer(world: VoxelWorld, position: THREE.Vector3, halfWidth: number): boolean {
  const minX = Math.floor(position.x - halfWidth);
  const maxX = Math.floor(position.x + halfWidth);
  const minZ = Math.floor(position.z - halfWidth);
  const maxZ = Math.floor(position.z + halfWidth);
  const y = Math.floor(position.y - 0.05);

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (world.isSolid(x, y, z)) return true;
    }
  }

  return false;
}
