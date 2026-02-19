import type { InventorySlot } from "@/lib/game/types";

type HotbarProps = {
  inventory: InventorySlot[];
  selectedSlot: number;
  onSelectSlot: (index: number) => void;
};

export default function Hotbar({ inventory, selectedSlot, onSelectSlot }: HotbarProps) {
  return (
    <div className="hotbar-bottom">
      {inventory.map((slot, idx) => (
        <button key={slot.id} className={idx === selectedSlot ? "hotbar-slot active" : "hotbar-slot"} onClick={() => onSelectSlot(idx)}>
          <span className="slot-index">{idx + 1}</span>
          <span className="slot-label">{slot.label}</span>
          <span className="slot-count">{slot.count}</span>
        </button>
      ))}
    </div>
  );
}
