# Minecraft-like Game (Next.js + TypeScript + Three.js + Bun)

A playable Minecraft-inspired prototype with voxel terrain, first-person movement, jumping, gravity, collisions, and block breaking/placing.

## Controls

- `W A S D`: Move
- `Space`: Jump
- `W + CapsLock`: Sprint
- `Mouse`: Look around (click game first to lock pointer)
- `Left click`: Break block
- `Right click`: Place selected block
- `1..5`: Select block type

## Run

```bash
bun install
bun run dev
```

Then open `http://localhost:3000`.

## Notes

- The world is generated procedurally at startup.
- Geometry is rebuilt after block edits for correctness.
