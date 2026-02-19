import * as THREE from "three";

type DayNightArgs = {
  dt: number;
  dayClock: number;
  dayHudTimer: number;
  sun: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  daySky: THREE.Color;
  nightSky: THREE.Color;
  liveSky: THREE.Color;
  scene: THREE.Scene;
  setDaylightPercent: (value: number) => void;
};

export function tickDayNight(args: DayNightArgs): { dayClock: number; dayHudTimer: number } {
  const { dt, sun, hemiLight, daySky, nightSky, liveSky, scene, setDaylightPercent } = args;
  let { dayClock, dayHudTimer } = args;

  dayClock += dt;
  const cycleSeconds = 240;
  const phase = (dayClock % cycleSeconds) / cycleSeconds;
  const sunAngle = phase * Math.PI * 2;
  const daylight = Math.max(0.04, Math.sin(sunAngle) * 0.95 + 0.05);

  sun.position.set(Math.cos(sunAngle) * 110, Math.sin(sunAngle) * 108, Math.sin(sunAngle * 0.7) * 80);
  sun.intensity = 0.2 + daylight * 1.2;
  hemiLight.intensity = 0.24 + daylight * 1.05;

  liveSky.copy(nightSky).lerp(daySky, daylight);
  scene.fog?.color.copy(liveSky);

  dayHudTimer += dt;
  if (dayHudTimer >= 0.25) {
    setDaylightPercent(Math.round(daylight * 100));
    dayHudTimer = 0;
  }

  return { dayClock, dayHudTimer };
}
