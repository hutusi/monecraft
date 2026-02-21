"use client";

import Hud from "@/components/game/Hud";
import Hotbar from "@/components/game/Hotbar";
import InventoryPanel from "@/components/game/InventoryPanel";
import RespawnOverlay from "@/components/game/RespawnOverlay";
import { useMinecraftGame } from "@/lib/game/useMinecraftGame";

export default function MinecraftGame() {
  const game = useMinecraftGame();

  return (
    <div className="game-root">
      <div ref={game.mountRef} className="game-canvas-wrap" />

      <Hud
        locked={game.locked}
        passiveCount={game.passiveCount}
        hostileCount={game.hostileCount}
        daylightPercent={game.daylightPercent}
        selectedSlotData={game.selectedSlotData}
        saveMessage={game.saveMessage}
        onSave={game.saveNow}
        onLoad={game.loadNow}
      />

      <Hotbar
        inventory={game.inventory}
        selectedSlot={game.selectedSlot}
        hotbarSlots={game.hotbarSlots}
        hearts={game.hearts}
        maxHearts={game.maxHearts}
        heartDisplay={game.heartDisplay}
        energy={game.energy}
        maxEnergy={game.maxEnergy}
        onSelectSlot={game.setSelectedSlot}
      />

      {game.inventoryOpen ? (
        <InventoryPanel
          inventory={game.inventory}
          selectedHotbarSlot={game.selectedSlot}
          hotbarSlots={game.hotbarSlots}
          recipes={game.recipes}
          canCraft={game.canCraft}
          onSwapSlots={game.swapInventorySlots}
          onCraft={game.craft}
        />
      ) : null}

      <RespawnOverlay seconds={game.respawnSeconds} />

      <div className="crosshair" />
      <div className={game.capsActive ? "caps-indicator on" : "caps-indicator"}>CapsLock {game.capsActive ? "ON (Sprint Enabled)" : "OFF"}</div>
    </div>
  );
}
