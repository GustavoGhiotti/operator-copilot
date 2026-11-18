import React, { useEffect, useRef, useState } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
// @ts-ignore
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import {
  loadTreeState,
  saveTreeState,
  TreeVisualState,
  OrnamentSave,
  saveMetaProgressState,
  loadMetaProgressState,
  premioDisponivel,
} from "@/utils/treeState";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "sonner";

import { updateSnow } from "./ui/natal/updateSnow";
import { loadGifts } from "./ui/natal/loadGift";
import { loadSnow } from "./ui/natal/loadSnow";
import { loadHDRI } from "./ui/natal/loadHDRI";
import { loadGlass } from "./ui/natal/loadGlass";
import { loadTree, ORNAMENTS_CONFIG } from "./ui/natal/loadTree";

interface ChristmasTreeModalPropsType {
  isOpen: boolean;
  onClose: () => void;
}

interface meta {
  Objetivo: number;
  Objetivo_alcançado: number;
  cumpriu: number;
  frequencia: string;
  id_meta: string;
  id_meta_operador: string;
  nome_meta: string;
  usada_no_sorteio: boolean;
  valor_atingido: number;
  valor_meta: number;
}
interface ranking {
  carteira: string;
  cpf: string;
  id_operador: string;
  metas_concluidas: number;
  nome: string;
}

type DailyMetaRecord = {
  [cpf: string]: {
    [metaId: string]: string[];
  };
};

type OrnamentUsageRecord = {
  [cpf: string]: {
    totalConquistado: number;
    totalUsado: number;
  };
};

export function calcularOrnamentLimitComControle(cpf: string, metas: meta[]) {
  const hoje = new Date().toISOString().split("T")[0];

  const metaStorageKey = `metas_concluidas_dia_${cpf}`;
  const usoStorageKey = `uso_de_enfeites_${cpf}`;

  const storedMeta = localStorage.getItem(metaStorageKey);
  const storedUso = localStorage.getItem(usoStorageKey);

  //  Parse seguro das metas
  let metaDb: DailyMetaRecord = {};
  try {
    const parsedMeta = storedMeta ? JSON.parse(storedMeta) : {};
    if (typeof parsedMeta === "object" && parsedMeta !== null) {
      metaDb = parsedMeta;
    }
  } catch (e) {
    console.warn(" Erro ao ler metas do localStorage:", e);
  }

  //  Parse seguro do uso de enfeites
  let usoDb: OrnamentUsageRecord = {};
  try {
    const parsedUso = storedUso ? JSON.parse(storedUso) : {};
    if (typeof parsedUso === "object" && parsedUso !== null) {
      usoDb = parsedUso;
    }
  } catch (e) {
    console.warn(" Erro ao ler uso_de_enfeites do localStorage:", e);
  }

  //  Garante estrutura por CPF
  if (!metaDb[cpf]) metaDb[cpf] = {};
  if (!usoDb[cpf]) usoDb[cpf] = { totalConquistado: 0, totalUsado: 0 };

  let somaHoje = 0;

  const { totalConquistado, totalUsado } = usoDb[cpf];
  const pendente = totalConquistado - totalUsado;

  if (pendente > 0) {
    return pendente;
  }

  //  Libera metas atingidas hoje
  metas.forEach((m) => {
    const metaId = m.id_meta.toString();
    const concluiu = m.valor_atingido >= m.valor_meta;
    if (!concluiu) return;

    const datas = metaDb[cpf][metaId] || [];
    const jaContouHoje = datas.includes(hoje);

    if (!jaContouHoje) {
      somaHoje += m.valor_meta;
      datas.push(hoje);
      metaDb[cpf][metaId] = datas;
    }
  });

  usoDb[cpf].totalConquistado += somaHoje;

  // Salva os dados atualizados
  localStorage.setItem(metaStorageKey, JSON.stringify(metaDb));
  localStorage.setItem(usoStorageKey, JSON.stringify(usoDb));

  return usoDb[cpf].totalConquistado - usoDb[cpf].totalUsado;
}

function registrarOrnamentoUsado(cpf: string) {
  const key = `uso_de_enfeites_${cpf}`;
  const raw = localStorage.getItem(key);
  const db: OrnamentUsageRecord = raw ? JSON.parse(raw) : {};

  if (!db[cpf]) db[cpf] = { totalConquistado: 0, totalUsado: 0 };
  db[cpf].totalUsado += 1;

  localStorage.setItem(key, JSON.stringify(db));
}

// CONFIGURAÇÃO DOS ENFEITES

const ChristmasTreeModalProps: React.FC<ChristmasTreeModalPropsType> = ({
  isOpen,
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const activeOrnamentIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const giftRef = useRef<THREE.Group | null>(null);
  const [idCarteira, setIdCarteira] = useState<string>("");
  const [metas, setMetas] = useState<meta[]>([]);
  const cpf = localStorage.getItem("userCpf");
  const centroCusto = localStorage.getItem("centroCusto");
  const [ranking, setRanking] = useState<ranking[]>([]);
  const [minhaPosicao, setMinhaPosicao] = useState<number | null>(null);
  const [meuNome, setMeuNome] = useState("");
  const [domReady, setDomReady] = useState(false);
  const [idOperador, setIdOperador] = useState("");
  const [temPremio, setTemPremio] = useState(false);

  async function verificarPremio() {
    const resultado = await premioDisponivel(idOperador);
    setTemPremio(resultado);
    return resultado;
  }

  useEffect(() => {
    if (!cpf) return;

    axiosInstance
      .get(`/api/natal/${cpf}/operador`)
      .then((res) => {
        const operador = res.data[0];

        if (operador) {
          setIdCarteira(operador.id_carteira);
          setIdOperador(operador.id_operador);
        }
      })
      .catch((err) => {
        console.warn("Erro ao carregar operador:", err);
      });
  }, [cpf]);

  useEffect(() => {
    if (!isOpen) return;
    if (!cpf) return;

    axiosInstance
      .get(`/api/operador/${cpf}/metas`)
      .then((res) => {
        setMetas(res.data);
      })

      .catch((err) => console.error("Erro ao buscar metas:", err));
  }, [isOpen, cpf]);

  useEffect(() => {
    if (!cpf) return;

    axiosInstance
      .post(`/api/meta/${cpf}/atingiu`)
      .then(() => {})
      .catch((err) => {
        console.error("Erro ao enviar atualização automática de metas:", err);
      });
  }, [cpf]);

  useEffect(() => {
    axiosInstance
      .get(`/api/carteira/${idCarteira}/ranking-metas`)
      .then((res) => {
        const lista = res.data || [];
        setRanking(lista);

        // Procurar a posição do usuário no ranking
        const index = lista.findIndex((item: any) => item.cpf === cpf);

        if (index !== -1) {
          setMinhaPosicao(index + 1); // posição = índice + 1
          setMeuNome(lista[index].nome);
        }

        // Verifica se o primeiro lugar é o usuário atual
      });
  }, [isOpen, idCarteira]);

  const [ornamentThumbs, setOrnamentThumbs] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    if (!cpf) return;
    loadMetaProgressState(cpf);
    loadTreeState(cpf).then((loaded) => {
      savedStateRef.current = {
        ornaments: Array.isArray(loaded?.ornaments) ? loaded.ornaments : [],
      };
    });
  }, [cpf]);

  const [dragPreview, setDragPreview] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [prizeOpen, setPrizeOpen] = useState(false);
  const [prizeName, setPrizeName] = useState<string>("");

  // Estado visual (somente enfeites)
  const savedStateRef = useRef<TreeVisualState | null>(null);
  const [ornamentsPlaced, setOrnamentsPlaced] = useState(
    savedStateRef.current?.ornaments.length || 0
  );

  //garante que quando os dados forem carregados, o contador seja sincronizado.
  useEffect(() => {
    if (savedStateRef.current?.ornaments) {
      setOrnamentsPlaced(savedStateRef.current.ornaments.length);
    }
  }, [savedStateRef.current?.ornaments]);

  //salvar quando um novo enfeite for colocado na arvore
  useEffect(() => {
    if (!cpf || !savedStateRef.current) return;
    saveTreeState(cpf, savedStateRef.current);
  }, [ornamentsPlaced]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setDomReady(true), 50);
    } else {
      setDomReady(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!domReady || !mountRef.current) return;

    const container = mountRef.current;

    /* --- SETUP THREE.JS --- */
    const scene = new THREE.Scene();
    const loader = new GLTFLoader();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 3, 10);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 2;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, 2.8, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 5));

    /* --- LOADING MODULES --- */
    let mixerTree: THREE.AnimationMixer | null = null;
    let mixerGift: THREE.AnimationMixer | null = null;

    let treeModel: THREE.Group | null = null;
    let giftModel: THREE.Group | null = null;
    let treeBounds: any = null;

    let twinkleLights: { mesh: THREE.Mesh; phase: number }[] = [];

    loadHDRI(scene);
    loadGlass(scene, loader);

    loadTree(
      scene,
      loader,
      savedStateRef,
      twinkleLights,
      ORNAMENTS_CONFIG
    ).then((data) => {
      treeModel = data.treeModel;
      mixerTree = data.mixerTree;
      treeBounds = data.treeBounds;
    });

    loadGifts(scene, loader, temPremio).then((data) => {
      giftModel = data.giftModel;
      mixerGift = data.mixerGift;
    });

    const { snow, snowCount, snowSpeeds } = loadSnow(scene);

    /* -------------- RAYCASTER -------------- */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    /* -------------- ENFEITES ---------------- */
    const ornamentPrototypes: Record<string, THREE.Group> = {};

    ORNAMENTS_CONFIG.forEach((cfg) => {
      loader.load(cfg.path, (gltf: any) => {
        const base = gltf.scene;
        base.scale.setScalar(cfg.scale);
        ornamentPrototypes[cfg.id] = base;

        /* gera thumbnails */
        const thumbScene = new THREE.Scene();
        thumbScene.add(new THREE.AmbientLight(0xffffff, 3));

        const thumbRenderer = new THREE.WebGLRenderer({ alpha: true });
        thumbRenderer.setSize(256, 256);

        const thumbCam = new THREE.PerspectiveCamera(7, 1, 0.1, 100);
        thumbCam.position.set(2, 2, 3);
        thumbCam.lookAt(0, -0.1, 0);

        // corrige posição inicial do enfeite
        const clone = base.clone();
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, Math.PI / 4, 0);
        thumbScene.add(clone);

        // renderiza e salva imagem
        thumbRenderer.render(thumbScene, thumbCam);
        const img = thumbRenderer.domElement.toDataURL("image/png");

        setOrnamentThumbs((prev) => ({
          ...prev,
          [cfg.id]: img,
        }));
      });
    });

    /* -------------- HIGHLIGHT -------------- */
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.12),
      new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.9,
      })
    );
    highlight.visible = false;
    scene.add(highlight);

    let lastPoint: THREE.Vector3 | null = null;

    /* ---------- LÓGICA DE POSICIONAR ENFEITE ---------- */
    const computePosition = (hitPoint: THREE.Vector3) => {
      if (!treeBounds) return hitPoint;
      const { minY, height } = treeBounds;

      const rel = (hitPoint.y - minY) / height;
      const layers = [
        { relY: 0.23, factor: 0.75 },
        { relY: 0.42, factor: 0.6 },
        { relY: 0.56, factor: 0.5 },
        { relY: 0.68, factor: 0.35 },
      ];
      let layer = rel < 0.3 ? 0 : rel < 0.5 ? 1 : rel < 0.7 ? 2 : 3;

      const cfg = layers[layer];
      const y = minY + height * cfg.relY;
      const r = 1.8 * cfg.factor;

      const angle = Math.atan2(hitPoint.z, hitPoint.x);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      return new THREE.Vector3(x, y, z);
    };

    /* ------- EVENTO MOVE (ARRASTO) ------- */
    const handleMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !treeModel) return;

      setDragPreview({
        id: activeOrnamentIdRef.current!,
        x: e.clientX,
        y: e.clientY,
      });

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const hits = raycaster.intersectObject(treeModel, true);
      if (!hits.length) {
        highlight.visible = false;
        lastPoint = null;
        return;
      }

      const pos = computePosition(hits[0].point.clone());
      highlight.position.copy(pos);
      highlight.visible = true;
      lastPoint = pos;
    };

    /* ------- SOLTAR ENFEITE ------- */
    const handleUp = async () => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      setDragPreview(null);
      highlight.visible = false;

      if (!lastPoint) return;

      const id = activeOrnamentIdRef.current;
      const proto = ornamentPrototypes[id!];
      if (!proto) return;

      const ornament = proto.clone();
      ornament.position.copy(lastPoint);

      scene.add(ornament);

      savedStateRef.current!.ornaments.push({
        id,
        pos: { x: lastPoint.x, y: lastPoint.y, z: lastPoint.z },
      });

      registrarOrnamentoUsado(cpf);

      ornamentsLeftRef.current--;
      setOrnamentsLeft((prev) => prev - 1);

      setOrnamentsPlaced((p) => p + 1);
      await saveMetaProgressState(cpf);
      await verificarPremio();
      lastPoint = null;
    };

    /* ------- CLICK PRESENTE ------- */
    const handleClick = async (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children, true);

      if (!hits.length) return;

      const obj = hits[0].object;

      if (obj.userData.isGift) {
        try {
          const result = await axiosInstance.get(
            `/api/sorteio/${cpf}`
          );
          setPrizeName(result.data.sorteado.premio);
          setPrizeOpen(true);
          await verificarPremio();
        } catch {
          toast.info("sem presentes disponíveis");
        }
      }
    };

    /* ------- EVENTOS GLOBAIS ------- */
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointerdown", handleClick);

    /* ------- ANIMAÇÃO ------- */
    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      updateSnow(snow, snowSpeeds, snowCount);

      if (highlight.visible) {
        const s = 1 + Math.sin(elapsed * 4) * 0.1;
        highlight.scale.set(s, s, s);
        highlight.lookAt(camera.position);
      }

      twinkleLights.forEach((light) => {
        const t = elapsed * 2 + light.phase;
        const r = (Math.sin(t) * 0.5 + 0.5) * 0.9;
        const g = (Math.sin(t + 2) * 0.5 + 0.5) * 0.9;
        const b = (Math.sin(t + 4) * 0.5 + 0.5) * 0.9;
        (light.mesh.material as any).emissive.setRGB(r, g, b);
      });

      if (mixerTree) mixerTree.update(delta);
      if (mixerGift) mixerGift.update(delta);

      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    /* ------- CLEANUP ------- */
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointerdown", handleClick);

      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
    };
  }, [domReady, temPremio]);

  useEffect(() => {
    if (!isOpen) return;
    if (!cpf) return;

    axiosInstance
      .get(`/api/operador/${cpf}/metas`)
      .then((res) => {
        setMetas(res.data);

        const existeMetaValida = res.data.some(
          (meta) =>
            (meta.cumpriu >= 1 || meta.cumpriu === true) &&
            (meta.usada_no_sorteio === 0 ||
              meta.usada_no_sorteio === false ||
              meta.usada_no_sorteio === null)
        );

        setIsTop1(existeMetaValida);
      })
      .catch((err) => console.error("Erro ao buscar metas:", err));
  }, [isOpen, cpf]);

  console.log("RES DATA", metas);
  const [isTop1, setIsTop1] = useState(Boolean);
  useEffect(() => {
    axiosInstance
      .get(`/api/carteira/${idCarteira}/ranking-metas`)
      .then((res) => {
        const lista = res.data || [];
        setRanking(lista);

        // Procurar a posição do usuário no ranking
        const index = lista.findIndex((item: any) => item.cpf === cpf);

        if (index !== -1) {
          setMinhaPosicao(index + 1); // posição = índice + 1
          setMeuNome(lista[index].nome);
        }

        // Verifica se o primeiro lugar é o usuário atual
      });
  }, [idCarteira]);

  // Salva estado visual ao fechar modal
  const handleClose = () => {
    if (savedStateRef.current) {
      saveTreeState(cpf, savedStateRef.current); // agora envia cpf
    }
    onClose();
  };

  const resetTree = () => {
    // 1. Remover todos os enfeites da cena

    // 2. Limpar estado salvo
    savedStateRef.current = {
      ...savedStateRef.current,
      ornaments: [],
    };

    // 3. Resetar contador
    setOrnamentsPlaced(0);
  };

  const [ornamentsLeft, setOrnamentsLeft] = useState(0);
  const ornamentsLeftRef = useRef(0);

  useEffect(() => {
    if (!metas || metas.length === 0) return;

    async function processar() {
      const calc = calcularOrnamentLimitComControle(cpf, metas);

      await verificarPremio();
      setOrnamentsLeft(calc); // atualiza React
      ornamentsLeftRef.current = calc; // atualiza Three.js
    }

    processar();
  }, [metas]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="p-0 border-none shadow-none  bg-transparent 
                     transition-all duration-500
    drop-shadow-[0_0_50px_rgba(215,215,255,.8)]"
        style={{
          background: "transparent",
          overflow: "hidden",
          width: "100vw",
          height: "100vh",
          maxWidth: "100vw",
        }}
      >
        {/* Título */}
        <div className="flex justify-center w-auto h-[12%] drop-shadow-[0_0_5px_rgba(215,215,255,.8)]">
          <img src="/images/Feliz natal.png" alt="Feliz Natal" />
        </div>
        {/* Canvas */}
        <div
          className="-z-10"
          ref={mountRef}
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 50,
            pointerEvents: "auto",
          }}
        />

        {/* Preview arrastado */}
        {dragPreview && ornamentThumbs[dragPreview.id] && (
          <div
            style={{
              position: "fixed",
              left: dragPreview.x,
              top: dragPreview.y,
              width: 64,
              height: 64,
              pointerEvents: "none",
              zIndex: 70,
              transform: "translate(-50%, -50%)",
            }}
          >
            <img
              src={ornamentThumbs[dragPreview.id]}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: 0.9,
              }}
            />
          </div>
        )}
        <style>
          {`
  /* Animação do gradiente correndo pela borda */
@keyframes runningLights {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}



  /* Borda com luzes correndo */
  .animated-border {
    border-radius: 26px;
  }

  .animated-border::before {
    content: "";
    position: absolute;
    inset: 0;
    padding: 4px; 
    border-radius: inherit;
    z-index: -1;

background: linear-gradient(
  90deg,
  rgba(0, 0, 0, 0) 0%,
  rgba(218, 165, 32, 0.0) 20%,
  rgba(255, 218, 165, 0.8) 40%,
  rgba(255, 218, 165, 1.0) 50%,
  rgba(255, 218, 165, 0.8) 60%,
  rgba(218, 165, 32, 0.0) 80%,
  rgba(0, 0, 0, 0) 100%
);

background-size: 600% 600%;
    animation: runningLights 2s linear infinite;

    /* Máscara para mostrar APENAS a borda */
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
  }

  @keyframes gradientGlow {
    0% {
      box-shadow: 0 0 25px rgba(215,215,255,.8);
      border-color: rgba(215,215,255,.8);
    }
    33% {
      box-shadow: 0 0 25px rgba(215,215,255,.8);
      border-color: rgba(215,215,255,.8);
    }
    100% {
     box-shadow: 0 0 25px rgba(215,215,255,.8);
      border-color: rgba(215,215,255,.8);
    }
  }

  .animate-variable-glow {
    animation: gradientGlow 6s infinite ease-in-out;
  }

            @keyframes christmasLights {
            0% {
              opacity: 0.4;
              transform: scale(0.8);
            }
            100% {
              opacity: 1;
              transform: scale(1.1);
            }
`}
        </style>

        <div
          style={{ zIndex: 9999 }}
          className="absolute 
  top-32
  left-2 
  bg-transparent
  backdrop-blur-md  
animate-variable-glow border animated-border
  rounded-xl 
  p-6 
  w-screen max-w-[33%] 
  h-auto 
  flex flex-col 

                     overflow-y-auto"
        >
          <h2
            className="text-xl font-semibold   text-white 
                       text-shadow-lg/20
                       text-shadow-white"
          >
            Metas -{" "}
            <span className="text-orange-300 font-black">{centroCusto}</span>
          </h2>
          <div className="space-y-4">
            {/* HUD */}
            <div
              className="relative top-2 flex flex-row items-center gap-2 pointer-events-none"
              style={{ zIndex: 60 }}
            >
              {ORNAMENTS_CONFIG.map((ornament) => (
                <button
                  key={ornament.id}
                  className="pointer-events-auto text-white text-xs rounded-md hover:bg-white/[2%] hover:border border-gray-800 transition flex flex-row place-items-center w-[60px] h-[60px]"
                  onMouseDown={(e) => {
                    if (ornamentsLeft <= 0) return;
                    e.preventDefault();
                    activeOrnamentIdRef.current = ornament.id;
                    isDraggingRef.current = true;
                    setDragPreview({
                      id: ornament.id,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                >
                  <div
                    title="Arraste para a Árvore"
                    className={
                      ornamentsLeft > 0
                        ? `
                          bg-white/10 rounded-md 
                          hover:bg-black/[70%]

                          animate-[pulse_.75s_ease-in-out_infinite]
                          hover:animate-none

                          [@keyframes_pulse]{0%,100%{background-color:#f00}30%{background-color:#ff8080}}
                        `
                        : `
                          bg-white/10 hover:bg-black/[70%] 
                          rounded-md flex items-center justify-center 
                          overflow-hidden transition-all duration-300 ease-in-out
                        `
                    }
                  >
                    <div className="h-full w-full top-1 absolute text-5xl font-semibold text-white/0 hover:text-slate-100/40 transition-all duration-300 ease-in-out">
                      {ornamentsLeft}
                    </div>
                    {ornamentThumbs[ornament.id] ? (
                      <img
                        src={ornamentThumbs[ornament.id]}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-slate-300">
                        Carregando
                      </span>
                    )}
                  </div>
                </button>
              ))}
              <h1
                className={
                  ornamentsLeft > 0
                    ? `
                      text-orange-300
                      animate-[pulse_.75s_ease-in-out_infinite]
                    `
                    : `
                      text-white
                    `
                }
              >
                {ornamentsLeft > 0
                  ? "Enfeites disponíveis"
                  : "Nenhum enfeite disponível"}
              </h1>
            </div>
            {/* <button
              onClick={resetTree}
              className="text-xs bg-red-600 px-2 py-1 rounded text-white"
            >
              Limpar árvore (teste)
            </button> */}
            {metas.map((m) => (
              <div
                key={m.id_meta_operador}
                className="flex flex-col items-start text-xl text-white bg-white/10 px-3 py-2 rounded-md gap-4"
              >
                <div className="absolute top-0 left-0 right-0 h-3 flex justify-around items-center overflow-hidden">
                  {Array.from({ length: 15 }, (_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: [
                          "#ff0000",
                          "#00ff00",
                          "#ffff00",
                          "#0099ff",
                          "#ff6600",
                        ][i % 5],
                        animation: `christmasLights 1s ease-in-out ${
                          i * 0.1
                        }s infinite alternate`,
                        boxShadow: `0 0 8px ${
                          [
                            "#ff0000",
                            "#00ff00",
                            "#ffff00",
                            "#0099ff",
                            "#ff6600",
                          ][i % 5]
                        }`,
                      }}
                    />
                  ))}
                </div>
                <span className="font-medium">{m.nome_meta}</span>
                <div className="flex justify-between w-full">
                  <div>
                    <span className="text-lg opacity-70">
                      Objetivo: {m.Objetivo_alcançado} / {m.Objetivo}
                    </span>
                  </div>
                  <div>
                    <strong
                      className={
                        m.Objetivo_alcançado >= m.Objetivo
                          ? "text-green-300"
                          : "text-red-300"
                      }
                    >
                      {m.Objetivo_alcançado >= m.Objetivo
                        ? "✔"
                        : `${Math.round(
                            (m.Objetivo_alcançado / m.Objetivo) * 100
                          )}%`}
                    </strong>
                  </div>
                </div>
                {/* Barra de progresso */}
                <div className="w-full h-[5px] bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      m.Objetivo_alcançado ? "bg-green-400" : "bg-red-400"
                    }`}
                    style={{
                      width: `${(m.Objetivo_alcançado / m.Objetivo) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{ zIndex: 9999 }}
          className="
  absolute 
  top-32
  right-2 
  bg-transparent 
  backdrop-blur-md 
 animate-variable-glow border animated-border
  rounded-xl 
  p-6 
  w-screen max-w-[33%] 
  h-auto 
  flex flex-col 
  gap-4
  text-white 
  overflow-y-auto
"
        >
          <h2 className="text-xl font-semibold ">Ranking da Carteira</h2>
          <div className="absolute top-0 left-0 right-0 h-3 flex justify-around items-center overflow-hidden">
            {Array.from({ length: 15 }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: [
                    "#ff0000",
                    "#00ff00",
                    "#ffff00",
                    "#0099ff",
                    "#ff6600",
                  ][i % 5],
                  animation: `christmasLights 1s ease-in-out ${
                    i * 0.1
                  }s infinite alternate`,
                  boxShadow: `0 0 8px ${
                    ["#ff0000", "#00ff00", "#ffff00", "#0099ff", "#ff6600"][
                      i % 5
                    ]
                  }`,
                }}
              />
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {ranking.length === 0 && (
              <div className="text-center text-white/50 text-sm">
                Carregando ranking...
              </div>
            )}

            {minhaPosicao && (
              <div
                className="mt-6 flex items-center justify-between
               px-4 py-4 rounded-xl border backdrop-blur-md
               bg-white/10 border-white/20 text-white"
              >
                <div className="text-3xl w-10 text-center">
                  {minhaPosicao === 1 && "🥇"}
                  {minhaPosicao === 2 && "🥈"}
                  {minhaPosicao === 3 && "🥉"}
                  {minhaPosicao > 3 && (
                    <span className="text-lg text-white/70">
                      {minhaPosicao}
                    </span>
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="font-semibold">{meuNome}</span>
                </div>

                <div className="font-bold text-lg text-green-300">
                  {ranking[minhaPosicao - 1]?.metas_concluidas ?? 0}
                </div>
              </div>
            )}
          </div>
        </div>
        {prizeOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-[200]"
            onClick={() => setPrizeOpen(false)}
          >
            <div
              className="bg-white text-black rounded-lg shadow-lg px-8 py-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">PARABÉNS!!!🥳🥳🥳</h2>

              <p className="text-lg">
                você ganhou um <strong>{prizeName}</strong>!!
              </p>

              <button
                className="mt-6 bg-blue-500 text-white px-4 py-2 rounded z-[200] hover:bg-blue-600"
                onClick={() => setPrizeOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChristmasTreeModalProps;
