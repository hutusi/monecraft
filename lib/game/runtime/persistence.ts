import { SAVE_KEY } from "@/lib/game/config";
import { inventorySlotsSnapshot, readSave, writeSave } from "@/lib/game/save";
import type { InventorySlot, SaveDataV1 } from "@/lib/game/types";

type CreatePersistenceHandlersArgs = {
  worldSeed: number;
  changedBlocks: Map<number, number>;
  inventoryRef: { current: InventorySlot[] };
  selectedSlotRef: { current: number };
  playerPosition: { x: number; y: number; z: number };
  setSaveMessage: (text: string) => void;
};

export function createPersistenceHandlers(args: CreatePersistenceHandlersArgs) {
  const { worldSeed, changedBlocks, inventoryRef, selectedSlotRef, playerPosition, setSaveMessage } = args;

  const persistSave = () => {
    try {
      const changes: Array<[number, number]> = [];
      for (const [idx, block] of changedBlocks.entries()) changes.push([idx, block]);

      const saveData: SaveDataV1 = {
        version: 1,
        seed: worldSeed,
        changes,
        inventorySlots: inventorySlotsSnapshot(inventoryRef.current),
        selectedSlot: selectedSlotRef.current,
        player: {
          x: playerPosition.x,
          y: playerPosition.y,
          z: playerPosition.z
        }
      };

      writeSave(SAVE_KEY, saveData);
      setSaveMessage("Saved");
      setTimeout(() => setSaveMessage(""), 1200);
    } catch {
      setSaveMessage("Save failed");
      setTimeout(() => setSaveMessage(""), 1200);
    }
  };

  const loadFromSave = () => {
    try {
      if (!readSave(SAVE_KEY)) {
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

  return { persistSave, loadFromSave };
}
