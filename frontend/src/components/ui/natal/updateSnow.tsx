import * as THREE from "three";

export function updateSnow(
  snow: THREE.Points,
  snowSpeeds: number[],
  snowCount: number
) {
  const pos = snow.geometry.getAttribute("position") as THREE.BufferAttribute;

  for (let i = 0; i < snowCount; i++) {
    let y = pos.getY(i);
    y -= snowSpeeds[i];

    // reiniciar floco quando cair demais
    if (y < -2) y = Math.random() * 25 + 10;

    pos.setY(i, y);
  }

  pos.needsUpdate = true;
}
