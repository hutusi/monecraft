import { useState } from "react";
import type { InventorySlot, Recipe } from "@/lib/game/types";

type InventoryPanelProps = {
  inventory: InventorySlot[];
  selectedHotbarSlot: number;
  hotbarSlots: number;
  recipes: Recipe[];
  canCraft: (recipe: Recipe) => boolean;
  onSwapSlots: (fromIndex: number, toIndex: number) => void;
  onCraft: (recipe: Recipe) => void;
};

export default function InventoryPanel({ inventory, selectedHotbarSlot, hotbarSlots, recipes, canCraft, onSwapSlots, onCraft }: InventoryPanelProps) {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const onSlotClick = (index: number) => {
    if (pendingIndex === null) {
      setPendingIndex(index);
      return;
    }
    if (pendingIndex === index) {
      setPendingIndex(null);
      return;
    }
    onSwapSlots(pendingIndex, index);
    setPendingIndex(null);
  };

  const hotbar = inventory.slice(0, hotbarSlots);
  const storage = inventory.slice(hotbarSlots);

  return (
    <div className="inventory-panel">
      <div className="inventory-title">Inventory & Crafting</div>
      <div className="inventory-subtitle">Click one slot, then another to move/swap items between hotbar and inventory.</div>
      <div className="inventory-section-title">Hotbar</div>
      <div className="inventory-grid">
        {hotbar.map((slot, idx) => (
          <button
            key={`inv-hotbar-${idx}`}
            className={idx === selectedHotbarSlot ? "inventory-slot active" : pendingIndex === idx ? "inventory-slot pending" : "inventory-slot"}
            onClick={() => onSlotClick(idx)}
          >
            <span>{slot.id ? slot.label : "Empty"}</span>
            <span>{slot.count > 0 ? `x${slot.count}` : ""}</span>
          </button>
        ))}
      </div>
      <div className="inventory-section-title">Storage</div>
      <div className="inventory-grid inventory-grid-storage">
        {storage.map((slot, offset) => {
          const idx = offset + hotbarSlots;
          return (
            <button key={`inv-storage-${idx}`} className={pendingIndex === idx ? "inventory-slot pending" : "inventory-slot"} onClick={() => onSlotClick(idx)}>
              <span>{slot.id ? slot.label : "Empty"}</span>
              <span>{slot.count > 0 ? `x${slot.count}` : ""}</span>
            </button>
          );
        })}
      </div>

      <div className="crafting-title">Recipes</div>
      <div className="crafting-list">
        {recipes.map((recipe) => (
          <button key={recipe.id} className="craft-btn" onClick={() => onCraft(recipe)} disabled={!canCraft(recipe)}>
            {recipe.label}
          </button>
        ))}
      </div>
    </div>
  );
}
