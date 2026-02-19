type RespawnOverlayProps = {
  seconds: number;
};

export default function RespawnOverlay({ seconds }: RespawnOverlayProps) {
  if (seconds <= 0) return null;

  return (
    <div className="respawn-overlay">
      <div className="respawn-card">
        <div className="respawn-title">You Died</div>
        <div className="respawn-sub">Respawning in {seconds}...</div>
      </div>
    </div>
  );
}
