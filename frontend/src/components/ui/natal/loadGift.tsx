import * as THREE from "three";

export interface LoadedGiftsData {
  giftModel: THREE.Group;
  mixerGift: THREE.AnimationMixer;
}

/**
 * Carrega os presentes (Gifts.glb ou GiftsIdle.glb), aplica animação e userData
 */
export function loadGifts(
  scene: THREE.Scene,
  loader: any,
  temPremio: boolean
): Promise<LoadedGiftsData> {
  const modelo = temPremio
    ? "/models/ChristmasTree/Gifts.glb"
    : "/models/ChristmasTree/GiftsIdle.glb";

  return new Promise((resolve, reject) => {
    loader.load(
      modelo,

      (gltf: any) => {
        const giftModel = gltf.scene;

        giftModel.scale.set(1.4, 1.4, 1.4);
        giftModel.position.set(0, 0, 0);
        giftModel.rotation.set(0, -45, 0);

        giftModel.traverse((obj: any) => {
          if (obj.isMesh) obj.userData.isGift = true;
        });

        scene.add(giftModel);

        const mixerGift = new THREE.AnimationMixer(giftModel);

        if (gltf.animations?.length) {
          const action = mixerGift.clipAction(gltf.animations[0]);
          action.play();
        }

        resolve({ giftModel, mixerGift });
      },

      undefined,
      (err: any) => {
        console.error("Erro ao carregar presentes:", err);
        reject(err);
      }
    );
  });
}
