import * as THREE from "three";
import { OrnamentSave } from "@/utils/treeState";

export interface OrnamentSystemConfig {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  treeModel: THREE.Group | null;
  treeBounds: { minY: number; maxY: number; height: number } | null;
  ornamentPrototypes: Record<string, THREE.Group>;
  savedStateRef: React.MutableRefObject<{ ornaments: OrnamentSave[] } | null>;
  ornamentsLeftRef: React.MutableRefObject<number>;
  setDragPreview: React.Dispatch<
    React.SetStateAction<{ id: string; x: number; y: number } | null>
  >;
  setOrnamentsLeft: React.Dispatch<React.SetStateAction<number>>;
  setOrnamentsPlaced: React.Dispatch<React.SetStateAction<number>>;
  registrarOrnamentoUsado: (cpf: string) => void;
  cpf: string;
  saveMetaProgressState: (cpf: string) => Promise<void>;
}

export function createOrnamentSystem({
  scene,
  camera,
  renderer,
  treeModel,
  treeBounds,
  ornamentPrototypes,
  savedStateRef,
  ornamentsLeftRef,
  setDragPreview,
  setOrnamentsLeft,
  setOrnamentsPlaced,
  registrarOrnamentoUsado,
  cpf,
  saveMetaProgressState,
}: OrnamentSystemConfig) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const highlightMesh = createHighlight(scene);

  let activeOrnamentId: string | null = null;
  let isDragging = false;
  let lastPoint: THREE.Vector3 | null = null;

  function createHighlight(scene: THREE.Scene) {
    const hGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const hMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(hGeo, hMat);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  }

  /* -------------------------------------------------
      POSIÇÃO EM CAMADAS DA ÁRVORE (4 níveis reais)
  -------------------------------------------------- */
  function computeLayeredPosition(hitPoint: THREE.Vector3) {
    if (!treeBounds) return hitPoint.clone();

    const { minY, height } = treeBounds;
    const rel = (hitPoint.y - minY) / height;

    const layerConfigs = [
      { relY: 0.23, radiusFactor: 0.75 },
      { relY: 0.42, radiusFactor: 0.6 },
      { relY: 0.56, radiusFactor: 0.5 },
      { relY: 0.68, radiusFactor: 0.35 },
    ];

    let idx = 0;
    if (rel < 0.3) idx = 0;
    else if (rel < 0.5) idx = 1;
    else if (rel < 0.7) idx = 2;
    else idx = 3;

    const cfg = layerConfigs[idx];

    const y = minY + height * cfg.relY + 0.05;
    const baseRadius = 1.8;
    const radius = baseRadius * cfg.radiusFactor;

    const angle = Math.atan2(hitPoint.z, hitPoint.x || 0.0001);

    return new THREE.Vector3(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius
    );
  }

  /* -------------------------------------------------
        INÍCIO DO DRAG
  -------------------------------------------------- */
  function startDrag(id: string, e: PointerEvent) {
    if (ornamentsLeftRef.current <= 0) return;

    activeOrnamentId = id;
    isDragging = true;

    setDragPreview({
      id,
      x: e.clientX,
      y: e.clientY,
    });
  }

  /* -------------------------------------------------
        MOVIMENTO DO DRAG
  -------------------------------------------------- */
  function handleMove(e: PointerEvent) {
    if (!isDragging || !treeModel) return;

    setDragPreview({
      id: activeOrnamentId!,
      x: e.clientX,
      y: e.clientY,
    });

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(treeModel, true);

    if (!hits.length) {
      highlightMesh.visible = false;
      lastPoint = null;
      return;
    }

    const hitPoint = hits[0].point.clone();
    const finalPos = computeLayeredPosition(hitPoint);

    highlightMesh.position.copy(finalPos);
    highlightMesh.visible = true;
    lastPoint = finalPos.clone();
  }

  /* -------------------------------------------------
       SOLTAR O ENFEITE
  -------------------------------------------------- */
  async function handleUp() {
    if (!isDragging) return;

    isDragging = false;
    setDragPreview(null);
    highlightMesh.visible = false;

    if (!activeOrnamentId || !lastPoint) return;
    if (ornamentsLeftRef.current <= 0) return;

    const prototype = ornamentPrototypes[activeOrnamentId];
    if (!prototype) return;

    // cria o enfeite na cena
    const ornament = prototype.clone();
    ornament.position.copy(lastPoint);
    ornament.userData.typeId = activeOrnamentId;
    scene.add(ornament);

    // registra no estado salvo
    savedStateRef.current!.ornaments.push({
      id: activeOrnamentId,
      pos: { x: lastPoint.x, y: lastPoint.y, z: lastPoint.z },
    });

    // uso do enfeite
    registrarOrnamentoUsado(cpf);

    setOrnamentsLeft((prev) => Math.max(prev - 1, 0));
    ornamentsLeftRef.current = Math.max(ornamentsLeftRef.current - 1, 0);

    setOrnamentsPlaced((prev) => prev + 1);
    await saveMetaProgressState(cpf);

    activeOrnamentId = null;
    lastPoint = null;
  }

  /* -------------------------------------------------
        ANIMAÇÃO DO HIGHLIGHT
  -------------------------------------------------- */
  function updateHighlight(elapsed: number, camera: THREE.Camera) {
    if (!highlightMesh.visible) return;
    const s = 1 + Math.sin(elapsed * 4) * 0.1;
    highlightMesh.scale.set(s, s, s);
    highlightMesh.lookAt(camera.position);
  }

  return {
    startDrag,
    handleMove,
    handleUp,
    updateHighlight,
  };
}