import type { InventorySlot } from "@/lib/game/types";

type HotbarProps = {
  inventory: InventorySlot[];
  selectedSlot: number;
  hotbarSlots: number;
  onSelectSlot: (index: number) => void;
};

export default function Hotbar({ inventory, selectedSlot, hotbarSlots, onSelectSlot }: HotbarProps) {
  const visible = inventory.slice(0, hotbarSlots);
  return (
    <div className="hotbar-bottom">
      {visible.map((slot, idx) => (
        <button key={`hotbar-${idx}`} className={idx === selectedSlot ? "hotbar-slot active" : "hotbar-slot"} onClick={() => onSelectSlot(idx)}>
          <span className="slot-index">{idx === 9 ? 0 : idx + 1}</span>
          <span className="slot-label">{slot.id ? slot.label : "Empty"}</span>
          <span className="slot-count">{slot.count > 0 ? slot.count : ""}</span>
        </button>
      ))}
    </div>
  );
}
