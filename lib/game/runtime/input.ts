import * as THREE from "three";

type ControlsState = {
  yaw: number;
  pitch: number;
  keys: Set<string>;
};

type BindGameInputArgs = {
  mount: HTMLDivElement;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: ControlsState;
  inventoryRef: { current: { id: string | null }[] };
  inventoryOpenRef: { current: boolean };
  isDeadRef: { current: boolean };
  leftMouseHeldRef: { current: boolean };
  mineTargetRef: { current: string };
  mineProgressRef: { current: number };
  setLocked: (locked: boolean) => void;
  hotbarSlots: number;
  setSelectedSlot: (idx: number) => void;
  setInventoryOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setCapsActive: (active: boolean) => void;
  placeSelectedBlock: () => void;
  onEatFood: () => void;
  tryAttackAction: () => boolean;
};

export function bindGameInput(args: BindGameInputArgs): () => void {
  const {
    mount,
    camera,
    renderer,
    controls,
    inventoryRef,
    inventoryOpenRef,
    isDeadRef,
    leftMouseHeldRef,
    mineTargetRef,
    mineProgressRef,
    setLocked,
    hotbarSlots,
    setSelectedSlot,
    setInventoryOpen,
    setCapsActive,
    placeSelectedBlock,
    onEatFood,
    tryAttackAction
  } = args;

  const rotateByMouse = (movementX: number, movementY: number) => {
    const sensitivity = 0.0021;
    controls.yaw -= movementX * sensitivity;
    controls.pitch -= movementY * sensitivity;
    controls.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, controls.pitch));
  };

  const onResize = () => {
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  };

  const onMouseMove = (evt: MouseEvent) => {
    if (document.pointerLockElement === renderer.domElement) rotateByMouse(evt.movementX, evt.movementY);
  };

  const onKeyDown = (evt: KeyboardEvent) => {
    if (evt.code.startsWith("Digit")) {
      const idx = evt.code === "Digit0" ? 9 : Number.parseInt(evt.code.slice(5), 10) - 1;
      if (idx >= 0 && idx < Math.min(hotbarSlots, inventoryRef.current.length)) setSelectedSlot(idx);
    }

    if (evt.code === "KeyI") {
      setInventoryOpen((prev) => !prev);
      controls.keys.clear();
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      return;
    }

    if (inventoryOpenRef.current || isDeadRef.current) return;

    if (evt.code === "KeyE") {
      evt.preventDefault();
      placeSelectedBlock();
    }
    if (evt.code === "KeyF") {
      evt.preventDefault();
      onEatFood();
    }

    controls.keys.add(evt.code);
    setCapsActive(evt.getModifierState("CapsLock"));
    if (evt.code === "Space") evt.preventDefault();
  };

  const onKeyUp = (evt: KeyboardEvent) => {
    controls.keys.delete(evt.code);
    setCapsActive(evt.getModifierState("CapsLock"));
  };

  const onMouseDown = (evt: MouseEvent) => {
    if (inventoryOpenRef.current || isDeadRef.current) return;
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
      return;
    }

    if (evt.button === 0) {
      leftMouseHeldRef.current = true;
      if (tryAttackAction()) {
        mineTargetRef.current = "";
        mineProgressRef.current = 0;
      }
    }
    if (evt.button === 2) placeSelectedBlock();
  };

  const onMouseUp = (evt: MouseEvent) => {
    if (evt.button !== 0) return;
    leftMouseHeldRef.current = false;
    mineTargetRef.current = "";
    mineProgressRef.current = 0;
  };

  const onContextMenu = (evt: MouseEvent) => evt.preventDefault();
  const onPointerLock = () => setLocked(document.pointerLockElement === renderer.domElement);

  window.addEventListener("resize", onResize);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("pointerlockchange", onPointerLock);

  return () => {
    window.removeEventListener("resize", onResize);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("pointerlockchange", onPointerLock);
  };
}
