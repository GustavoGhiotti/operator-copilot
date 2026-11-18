import * as THREE from "three";

export interface LoadedGlassData {
  glass: THREE.Group;
}

/**
 * Carrega o globo de vidro com material físico transparente.
 */
export function loadGlass(
  scene: THREE.Scene,
  loader: any
): Promise<LoadedGlassData> {
  return new Promise((resolve, reject) => {
    loader.load(
      "/models/ChristmasTree/Glasss.gltf",

      (gltf: any) => {
        const glass = gltf.scene;

        glass.scale.set(1.4, 1.4, 1.4);
        glass.position.set(0, 0, 0);

        // Aplicação dos materiais de vidro
        glass.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.castShadow = false;
            obj.receiveShadow = false;

            // Ignora clicks (não abre presentes)
            obj.userData.ignoreClick = true;

            obj.material = new THREE.MeshPhysicalMaterial({
              color: 0xffffff,

              // Transparência
              transparent: true,
              opacity: 0.25,
              transmission: 0.0,
              attenuationDistance: 0,

              // Reflexo HDRI
              envMap: scene.environment,
              envMapIntensity: 1.5,

              // Aparência do vidro
              roughness: 0.01,
              metalness: 1.0,
              clearcoat: 0.5,
              clearcoatRoughness: 0.05,
            });
          }
        });

        // Render order alto para não interferir com a árvore
        glass.renderOrder = 999;

        scene.add(glass);

        // Ajuste de iluminação opcional
        (scene as any).environmentIntensity = 0.5;

        resolve({ glass });
      },

      undefined,

      (err: any) => {
        console.error("Erro carregando Glass.gltf:", err);
        reject(err);
      }
    );
  });
}
