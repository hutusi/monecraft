import type { InventorySlot } from "@/lib/game/types";

type HotbarProps = {
  inventory: InventorySlot[];
  selectedSlot: number;
  hotbarSlots: number;
  hearts: number;
  maxHearts: number;
  energy: number;
  maxEnergy: number;
  onSelectSlot: (index: number) => void;
};

export default function Hotbar({ inventory, selectedSlot, hotbarSlots, hearts, maxHearts, energy, maxEnergy, onSelectSlot }: HotbarProps) {
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
      food: "🍖",
      knife: "🔪",
      wood_sword: "⚔️",
      stone_sword: "⚔️"
    };
    return byId[slot.id] ?? "📦";
  };

  const visible = inventory.slice(0, hotbarSlots);
  return (
    <div className="hotbar-wrap">
      <div className="hotbar-status">
        <div className="hotbar-stats-line">
          <span>Health: {hearts}/{maxHearts}</span>
          <span>Energy: {Math.round(energy)}/{maxEnergy}</span>
        </div>
        <div className="health-bar">
          <div className="health-fill" style={{ width: `${Math.max(0, Math.min(100, (hearts / maxHearts) * 100))}%` }} />
        </div>
        <div className="energy-bar">
          <div className="energy-fill" style={{ width: `${Math.max(0, Math.min(100, (energy / maxEnergy) * 100))}%` }} />
        </div>
      </div>
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
    </div>
  );
}
