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
      gold_ore: "🟡",
      sapphire_ore: "🔷",
      diamond_ore: "💎",
      wood_pickaxe: "⛏️",
      stone_pickaxe: "⛏️",
      sliver_pickaxe: "⛏️",
      ruby_pickaxe: "⛏️",
      sapphire_pickaxe: "⛏️",
      gold_pickaxe: "⛏️",
      diamond_pickaxe: "⛏️",
      food: "🍖",
      knife: "🔪",
      wood_sword: "⚔️",
      stone_sword: "⚔️",
      sliver_sword: "⚔️",
      ruby_sword: "⚔️",
      sapphire_sword: "⚔️",
      gold_sword: "⚔️",
      diamond_sword: "⚔️",
      helmet: "⛑️",
      face_mask: "🎭",
      neck_protection: "🧣",
      chestplate: "🛡️",
      leggings: "🥋",
      boots: "🥾"
    };
    return byId[slot.id] ?? "📦";
  };

  const visible = inventory.slice(0, hotbarSlots);
  const selected = visible[selectedSlot];
  return (
    <div className="hotbar-wrap">
      <div className="hotbar-status">
        <div className="hotbar-status-row">
          <span className="hotbar-status-label">Health</span>
          <span className="hotbar-status-value">{hearts}/{maxHearts}</span>
        </div>
        <div className="status-track health-bar">
          <div className="status-fill health-fill" style={{ width: `${Math.max(0, Math.min(100, (hearts / maxHearts) * 100))}%` }} />
        </div>
        <div className="hotbar-status-row">
          <span className="hotbar-status-label">Energy</span>
          <span className="hotbar-status-value">{Math.round(energy)}/{maxEnergy}</span>
        </div>
        <div className="status-track energy-bar">
          <div className="status-fill energy-fill" style={{ width: `${Math.max(0, Math.min(100, (energy / maxEnergy) * 100))}%` }} />
        </div>
        <div className="hotbar-selected-chip">Selected: {selected?.id ? selected.label : "Empty"}</div>
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
