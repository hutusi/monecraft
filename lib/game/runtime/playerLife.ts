type MutableRef<T> = { current: T };

type CreateApplyDamageArgs = {
  heartsRef: MutableRef<number>;
  isDeadRef: MutableRef<boolean>;
  respawnTimerRef: MutableRef<number>;
  respawnShownRef: MutableRef<number>;
  setHearts: (value: number) => void;
  setRespawnSeconds: (value: number) => void;
  clearControls: () => void;
  exitPointerLock: () => void;
};

export function createApplyDamage(args: CreateApplyDamageArgs): (amount: number) => void {
  const { heartsRef, isDeadRef, respawnTimerRef, respawnShownRef, setHearts, setRespawnSeconds, clearControls, exitPointerLock } = args;

  return (amount: number) => {
    if (isDeadRef.current) return;
    const value = Math.max(0, Math.floor(amount));
    if (value <= 0) return;

    const next = Math.max(0, heartsRef.current - value);
    heartsRef.current = next;
    setHearts(next);
    if (next > 0) return;

    isDeadRef.current = true;
    respawnTimerRef.current = 3;
    respawnShownRef.current = 3;
    setRespawnSeconds(3);
    clearControls();
    exitPointerLock();
  };
}

type TickDeathArgs = {
  dt: number;
  maxHearts: number;
  heartsRef: MutableRef<number>;
  isDeadRef: MutableRef<boolean>;
  respawnTimerRef: MutableRef<number>;
  respawnShownRef: MutableRef<number>;
  setHearts: (value: number) => void;
  setRespawnSeconds: (value: number) => void;
  onRespawn: () => void;
  onDeadFrame: () => void;
};

export function tickDeathAndRespawn(args: TickDeathArgs): { skipFrame: boolean } {
  const { dt, maxHearts, heartsRef, isDeadRef, respawnTimerRef, respawnShownRef, setHearts, setRespawnSeconds, onRespawn, onDeadFrame } = args;

  if (!isDeadRef.current) return { skipFrame: false };

  respawnTimerRef.current -= dt;
  const left = Math.max(0, Math.ceil(respawnTimerRef.current));
  if (left !== respawnShownRef.current) {
    respawnShownRef.current = left;
    setRespawnSeconds(left);
  }

  if (respawnTimerRef.current <= 0) {
    heartsRef.current = maxHearts;
    setHearts(maxHearts);
    isDeadRef.current = false;
    respawnShownRef.current = 0;
    setRespawnSeconds(0);
    onRespawn();
    return { skipFrame: false };
  }

  onDeadFrame();
  return { skipFrame: true };
}
