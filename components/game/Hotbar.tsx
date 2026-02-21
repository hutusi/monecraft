import type { InventorySlot } from "@/lib/game/types";

type HotbarProps = {
  inventory: InventorySlot[];
  selectedSlot: number;
  hotbarSlots: number;
  onSelectSlot: (index: number) => void;
};

export default function Hotbar({ inventory, selectedSlot, hotbarSlots, onSelectSlot }: HotbarProps) {
  const iconForSlot = (slot: InventorySlot): string => {
    if (!slot.id || slot.count <= 0) return "";
    const byId: Record<string, string> = {
      grass: "🟩",
      dirt: "🟫",
      stone: "🪨",
      wood: "🪵",
      planks: "🟫",
      cobble: "🪨",
      sand: "🟨",
      brick: "🧱",
      glass: "🔷",
      sliver_ore: "⚪",
      ruby_ore: "🔴",
      wood_pickaxe: "⛏️",
      stone_pickaxe: "⛏️",
      sliver_pickaxe: "⛏️",
      knife: "🔪",
      wood_sword: "⚔️",
      stone_sword: "⚔️"
    };
    return byId[slot.id] ?? "📦";
  };

  const visible = inventory.slice(0, hotbarSlots);
  return (
    <div className="hotbar-bottom">
      {visible.map((slot, idx) => (
        <button key={`hotbar-${idx}`} className={idx === selectedSlot ? "hotbar-slot active" : "hotbar-slot"} onClick={() => onSelectSlot(idx)}>
          <span className="slot-index">{idx === 9 ? 0 : idx + 1}</span>
          <span className={slot.id ? "slot-icon" : "slot-icon empty"}>{iconForSlot(slot)}</span>
          <span className="slot-label">{slot.id ? slot.label : "Empty"}</span>
          <span className="slot-count">{slot.count > 0 ? slot.count : ""}</span>
        </button>
      ))}
    </div>
  );
}
