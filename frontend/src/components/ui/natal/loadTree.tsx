import * as THREE from "three";
import { OrnamentSave } from "@/utils/treeState";

export interface LoadedTreeData {
  treeModel: THREE.Group;
  mixerTree: THREE.AnimationMixer;
  treeBounds: { minY: number; maxY: number; height: number };
}

export const ORNAMENTS_CONFIG = [
  {
    id: "bola_vermelha",
    label: "Bola vermelha",
    path: "/models/ChristmasTree/ball.glb",
    scale: 1.2,
    // limit: 10,
  },
];

export function applySavedOrnaments(
  ornaments: OrnamentSave[],
  scene: THREE.Scene,
  loader: any,
  config: typeof ORNAMENTS_CONFIG
) {
  ornaments.forEach((item) => {
    const cfg = config.find((c) => c.id === item.id);
    if (!cfg) return;

    loader.load(cfg.path, (gltf: any) => {
      const ornament = gltf.scene.clone();
      ornament.scale.set(cfg.scale, cfg.scale, cfg.scale);
      ornament.position.set(item.pos.x, item.pos.y, item.pos.z);
      ornament.userData.typeId = item.id;
      scene.add(ornament);
    });
  });
}

/**
 * Carrega a árvore 3D, animação, pisca-pisca, bounds
 */
export function loadTree(
  scene: THREE.Scene,
  loader: any,
  savedStateRef: React.MutableRefObject<any>,
  twinkleLights: { mesh: THREE.Mesh; phase: number }[],
  ORNAMENTS_CONFIG: any[]
): Promise<LoadedTreeData> {
  return new Promise((resolve, reject) => {
    loader.load(
      "/models/ChristmasTree/christmas_tree.glb",
      (gltf: any) => {
        // Modelo base
        const treeModel = gltf.scene;
        treeModel.scale.set(1.4, 1.4, 1.4);
        treeModel.position.set(0, 0, 0);
        scene.add(treeModel);

        // Mixer
        const mixerTree = new THREE.AnimationMixer(treeModel);

        if (gltf.animations?.length > 0) {
          const primeiraAnimacao = gltf.animations[0];
          const action = mixerTree.clipAction(primeiraAnimacao);
          action.play();
        }

        // Pisca–pisca
        const lightsGroup = new THREE.Group();
        scene.add(lightsGroup);

        const positions: THREE.Vector3[] = [];
        for (let i = 12; i < 60; i++) {
          const angle = i * 0.5;
          const y = (i / 80) * 7;
          const radius = 2 - (i / 32) * 1;

          positions.push(
            new THREE.Vector3(
              Math.cos(angle) * radius,
              y,
              Math.sin(angle) * radius
            )
          );
        }

        positions.forEach((pos) => {
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshStandardMaterial({
              emissive: new THREE.Color("red"),
              emissiveIntensity: 1,
              color: "black",
            })
          );

          bulb.position.copy(pos);
          lightsGroup.add(bulb);

          twinkleLights.push({
            mesh: bulb,
            phase: Math.random() * Math.PI * 2,
          });
        });

        // Bound box da árvore
        const box = new THREE.Box3().setFromObject(treeModel);
        const treeBounds = {
          minY: box.min.y,
          maxY: box.max.y,
          height: box.max.y - box.min.y,
        };

        // Reconstrói enfeites já posicionados
        if (savedStateRef.current) {
          applySavedOrnaments(
            savedStateRef.current.ornaments,
            scene,
            loader,
            ORNAMENTS_CONFIG
          );
        }

        resolve({ treeModel, mixerTree, treeBounds });
      },

      undefined,
      (err: any) => {
        console.error("Erro ao carregar árvore:", err);
        reject(err);
      }
    );
  });
}
