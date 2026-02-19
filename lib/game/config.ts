import { BlockId } from "@/lib/world";
import type { InventorySlot, Recipe } from "@/lib/game/types";

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_HALF_WIDTH = 0.3;
export const EYE_HEIGHT = 1.62;
export const GRAVITY = 26;
export const JUMP_VELOCITY = 8.2;
export const WALK_SPEED = 4.8;
export const SPRINT_SPEED = 12.8;
export const CROUCH_SPEED = 2.1;
export const MAX_HEARTS = 50;
export const RENDER_RADIUS = 90;
export const RENDER_GRID = 20;

export const SAVE_KEY = "minecraft_save_v1";

export const BREAK_HARDNESS: Partial<Record<BlockId, number>> = {
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

export const INITIAL_INVENTORY: InventorySlot[] = [
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

export const BLOCK_TO_SLOT: Partial<Record<BlockId, string>> = {
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

export const RECIPES: Recipe[] = [
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
