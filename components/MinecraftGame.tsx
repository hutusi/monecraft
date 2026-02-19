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
        hearts={game.hearts}
        maxHearts={game.maxHearts}
        heartDisplay={game.heartDisplay}
        saveMessage={game.saveMessage}
        onSave={game.saveNow}
        onLoad={game.loadNow}
      />

      <Hotbar inventory={game.inventory} selectedSlot={game.selectedSlot} onSelectSlot={game.setSelectedSlot} />

      {game.inventoryOpen ? (
        <InventoryPanel
          inventory={game.inventory}
          selectedSlot={game.selectedSlot}
          recipes={game.recipes}
          canCraft={game.canCraft}
          onSelectSlot={game.setSelectedSlot}
          onCraft={game.craft}
        />
      ) : null}

      <RespawnOverlay seconds={game.respawnSeconds} />

      <div className="crosshair" />
      <div className={game.capsActive ? "caps-indicator on" : "caps-indicator"}>CapsLock {game.capsActive ? "ON (Sprint Enabled)" : "OFF"}</div>
    </div>
  );
}
