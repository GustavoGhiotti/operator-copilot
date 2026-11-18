import * as THREE from "three";

export interface LoadedSnowData {
  snow: THREE.Points;
  snowSpeeds: number[];
  snowCount: number;
}

/**
 * Carrega a neve, geometria, textura e velocidades.
 */
export function loadSnow(scene: THREE.Scene): LoadedSnowData {
  const snowCount = 900;

  const snowGeometry = new THREE.BufferGeometry();
  const snowPositions = new Float32Array(snowCount * 3);
  const snowSpeeds: number[] = [];

  const textureLoader = new THREE.TextureLoader();

  // Textura do floco
  const snowflakeTexture = textureLoader.load(
    "/models/ChristmasTree/textures/snowflake.png"
  );

  // Configura posições iniciais
  for (let i = 0; i < snowCount; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 40;
    snowPositions[i * 3 + 1] = Math.random() * 30 + 10;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;

    snowSpeeds[i] = 0.02 + Math.random() * 0.03;
  }

  snowGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(snowPositions, 3)
  );

  const snowMaterial = new THREE.PointsMaterial({
    map: snowflakeTexture,
    size: 0.3,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    alphaTest: 0.1,
    sizeAttenuation: true,
  });

  const snow = new THREE.Points(snowGeometry, snowMaterial);
  scene.add(snow);

  return { snow, snowSpeeds, snowCount };
}