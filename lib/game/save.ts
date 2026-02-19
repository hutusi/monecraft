import type { SaveDataV1, InventorySlot } from "@/lib/game/types";

export function readSave(saveKey: string): SaveDataV1 | null {
  try {
    const raw = localStorage.getItem(saveKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveDataV1;
    if (parsed?.version !== 1 || !Number.isFinite(parsed.seed) || !Array.isArray(parsed.changes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSave(saveKey: string, data: SaveDataV1): void {
  localStorage.setItem(saveKey, JSON.stringify(data));
}

export function inventoryCountsMap(inventory: InventorySlot[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of inventory) out[slot.id] = slot.count;
  return out;
}
