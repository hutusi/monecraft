import type { InventorySlot, Recipe } from "@/lib/game/types";

type InventoryPanelProps = {
  inventory: InventorySlot[];
  selectedSlot: number;
  recipes: Recipe[];
  canCraft: (recipe: Recipe) => boolean;
  onSelectSlot: (index: number) => void;
  onCraft: (recipe: Recipe) => void;
};

export default function InventoryPanel({ inventory, selectedSlot, recipes, canCraft, onSelectSlot, onCraft }: InventoryPanelProps) {
  return (
    <div className="inventory-panel">
      <div className="inventory-title">Inventory & Crafting</div>
      <div className="inventory-grid">
        {inventory.map((slot, idx) => (
          <button key={`inv-${idx}`} className={idx === selectedSlot ? "inventory-slot active" : "inventory-slot"} onClick={() => onSelectSlot(idx)}>
            <span>{slot.id ? slot.label : "Empty"}</span>
            <span>{slot.count > 0 ? `x${slot.count}` : ""}</span>
          </button>
        ))}
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
