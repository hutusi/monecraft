import type { InventorySlot } from "@/lib/game/types";

type HudProps = {
  locked: boolean;
  passiveCount: number;
  hostileCount: number;
  daylightPercent: number;
  selectedSlotData?: InventorySlot;
  hearts: number;
  maxHearts: number;
  heartDisplay: boolean[];
  saveMessage: string;
  onSave: () => void;
  onLoad: () => void;
};

export default function Hud(props: HudProps) {
  const {
    locked,
    passiveCount,
    hostileCount,
    daylightPercent,
    selectedSlotData,
    hearts,
    maxHearts,
    heartDisplay,
    saveMessage,
    onSave,
    onLoad
  } = props;

  return (
    <div className="hud">
      <div className="title">Minecraft-ish</div>
      <div className="help">
        <span>{locked ? "Mouse: Look" : "Click to lock mouse"}</span>
        <span>Move: W/S forward-back, A/D strafe</span>
        <span>Sprint: W + CapsLock | Crouch: C</span>
        <span>Attack: Left click | Mine: Hold left click | Place: Right click or E</span>
        <span>Stone needs pickaxe, Sliver needs Stone Pickaxe, Ruby needs Sliver Pickaxe</span>
        <span>Inventory/Crafting: I | Hotbar: 1..0 | Max Stack: 99</span>
      </div>
      <div className="stats-line">Passive Mobs: {passiveCount} | Hostile Mobs: {hostileCount}</div>
      <div className="stats-line">Daylight: {daylightPercent}%</div>
      <div className="stats-line">Selected: {selectedSlotData?.label ?? "None"}</div>
      <div className="save-controls">
        <button className="save-btn" onClick={onSave}>
          Save World
        </button>
        <button className="save-btn" onClick={onLoad}>
          Load Save
        </button>
        {saveMessage ? <span className="save-msg">{saveMessage}</span> : null}
      </div>

      <div className="health-wrap">
        <div className="health-label">Health: {hearts} / {maxHearts} hearts</div>
        <div className="health-bar">
          {heartDisplay.map((filled, idx) => (
            <span key={idx} className={filled ? "heart filled" : "heart"}>
              ♥
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
