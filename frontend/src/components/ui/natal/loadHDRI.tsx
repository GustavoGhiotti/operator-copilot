import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

export interface LoadedHDRIData {
  texture: THREE.Texture;
}

/**
 * Carrega HDRI e configura como iluminação global da cena.
 */
export function loadHDRI(
  scene: THREE.Scene,
  path: string = "/models/ChristmasTree/hdri/hdri_background.hdr"
): Promise<LoadedHDRIData> {
  return new Promise((resolve, reject) => {
    const rgbeLoader = new RGBELoader();

    rgbeLoader.load(
      path,

      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;

        // Definir como iluminação global
        scene.environment = texture;

        // Fundo transparente / canvas controla fundo
        scene.background = null;

        resolve({ texture });
      },

      undefined,

      (err) => {
        console.error("Erro carregando HDRI:", err);
        reject(err);
      }
    );
  });
}
