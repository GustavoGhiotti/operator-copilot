import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { animate } from "animejs/animation";
import { createAnimatable } from "animejs/animatable";
import { createScope } from "animejs/scope";
import { createTimeline } from "animejs/timeline";
import { stagger } from "animejs/utils";
import { AuroraInteractionContext } from "@/context/AuroraInteractionContext";

interface AuroraStageProps {
  children: React.ReactNode;
  statusText?: string;
}

/* Dimensões nativas das artes da Aurora. Todas as camadas do rig ocular
   são posicionadas sobre este retângulo, e não sobre a caixa do elemento,
   para que os recortes não saiam do lugar quando a proporção da tela
   difere da proporção da arte. */
const FACE_WIDTH = 1672;
const FACE_HEIGHT = 941;

/* Curso máximo da íris, em pixels da arte original. A abertura tem ~40px de
   meia-largura e a íris ~19,5px de raio: sobram ~20px até o canto do olho,
   e 7px mantém o movimento no registro discreto de quem acompanha a tela. */
const IRIS_TRAVEL_X = 7;
const IRIS_TRAVEL_Y = 2.2;
const SACCADE_RANGE = 0.8;

/* Fisionomia "friendly". As três artes precisam ser da MESMA geração —
   trocar só o rosto desalinha o leito e a piscada. */
const ART_FACE = "/images/aurora/aurora-friendly-mouth-fv-v1.png";
const ART_EYE_BED = "/images/aurora/aurora-friendly-eye-bed-v1.png";
const ART_EYES_CLOSED = "/images/aurora/aurora-friendly-eyes-closed-v1.png";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getTypingDuration = (message: string) =>
  Math.max(1800, message.length * 52);

const commandDisplayName = (command: string) => {
  const names: Record<string, string> = {
    "@IA": "a Aurora IA",
    "@Resultados": "seus Resultados",
    "@Senhas": "a área de Senhas",
    "@AuroraInsight": "o Aurora Insight",
    "@Arena": "a Arena Aurora",
    "@Monitoria": "a Monitoria",
    "@QuizQualidade": "a gestão do Quiz da Qualidade",
    "@SimulacaoQualidade": "a Simulação da Qualidade",
    "@CriarTabulacao": "a criação de Tabulações",
  };

  return names[command] || `o comando ${command.replace(/^@/, "")}`;
};

const AuroraStage: React.FC<AuroraStageProps> = ({
  children,
  statusText = "AURORA ONLINE",
}) => {
  const stageRef = useRef<HTMLElement>(null);
  const faceShellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const interactionTimerRef = useRef<number | null>(null);
  const irisMotionRef = useRef<ReturnType<typeof createAnimatable> | null>(null);
  const faceScaleRef = useRef(1);
  const gazeTargetRef = useRef({ x: 0, y: 0 });
  const saccadeRef = useRef({ x: 0, y: 0 });
  const motionStrengthRef = useRef(1);
  const announcementTimerRef = useRef<number | null>(null);
  const announcementResetTimerRef = useRef<number | null>(null);
  const typingAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [displayedAnnouncement, setDisplayedAnnouncement] = useState("");
  const [isAnnouncing, setIsAnnouncing] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const deviceMemory = (
      navigator as Navigator & { deviceMemory?: number }
    ).deviceMemory;
    const logicalProcessors = navigator.hardwareConcurrency || 2;
    const economicalMode =
      (deviceMemory !== undefined && deviceMemory <= 4) ||
      logicalProcessors <= 2;
    motionStrengthRef.current = economicalMode ? 0.62 : 1;

    stage?.setAttribute(
      "data-performance",
      economicalMode ? "economical" : "complete",
    );

    const handleVisibilityChange = () => {
      stage?.setAttribute(
        "data-visible",
        document.hidden ? "false" : "true",
      );
    };
    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      if (interactionTimerRef.current !== null) {
        window.clearTimeout(interactionTimerRef.current);
      }
      if (announcementTimerRef.current !== null) {
        window.clearTimeout(announcementTimerRef.current);
      }
      if (announcementResetTimerRef.current !== null) {
        window.clearTimeout(announcementResetTimerRef.current);
      }
      typingAnimationRef.current?.revert();
    };
  }, []);

  useEffect(() => {
    if (!announcement) {
      setDisplayedAnnouncement("");
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setDisplayedAnnouncement(announcement);
      return;
    }

    const progress = { characters: 0 };
    let previousCharacterCount = -1;

    typingAnimationRef.current = animate(progress, {
      characters: announcement.length,
      duration: getTypingDuration(announcement),
      ease: "linear",
      onUpdate: () => {
        const characterCount = Math.min(
          announcement.length,
          Math.floor(progress.characters),
        );
        if (characterCount === previousCharacterCount) return;

        previousCharacterCount = characterCount;
        setDisplayedAnnouncement(announcement.slice(0, characterCount));
      },
      onComplete: () => setDisplayedAnnouncement(announcement),
    });

    return () => {
      typingAnimationRef.current?.revert();
      typingAnimationRef.current = null;
    };
  }, [announcement]);

  useEffect(() => {
    const intro = introRef.current;
    if (!intro || !announcement) return;

    const animation = animate(intro, {
      opacity: [0, 1],
      translateY: [8, 0],
      scale: [0.985, 1],
      duration: 520,
      ease: "out(4)",
    });

    return () => {
      animation.revert();
    };
  }, [announcement]);

  /* Único ponto que move a íris: combina o alvo do ponteiro com a
     micro-sacada e converte de pixels da arte para pixels da tela. */
  const applyGaze = useCallback(() => {
    const motion = irisMotionRef.current;
    if (!motion) return;

    const strength = motionStrengthRef.current;
    const scale = faceScaleRef.current;
    const target = gazeTargetRef.current;
    const saccade = saccadeRef.current;

    const offsetX = clamp(
      target.x * 2 * IRIS_TRAVEL_X + saccade.x,
      -IRIS_TRAVEL_X,
      IRIS_TRAVEL_X,
    );
    const offsetY = clamp(
      target.y * 2 * IRIS_TRAVEL_Y + saccade.y,
      -IRIS_TRAVEL_Y,
      IRIS_TRAVEL_Y,
    );

    motion.translateX(offsetX * strength * scale);
    motion.translateY(offsetY * strength * scale);
  }, []);

  /* Reproduz a geometria de `object-fit: cover` em variáveis CSS para que
     as camadas do olho fiquem travadas no rosto em qualquer proporção. */
  useEffect(() => {
    const stage = stageRef.current;
    const shell = faceShellRef.current;
    if (!stage || !shell) return;

    const updateFaceGeometry = () => {
      const width = shell.offsetWidth;
      const height = shell.offsetHeight;
      if (!width || !height) return;

      const scale = Math.max(width / FACE_WIDTH, height / FACE_HEIGHT);
      faceScaleRef.current = scale;
      stage.style.setProperty("--face-scale", scale.toFixed(5));
      stage.style.setProperty(
        "--face-x",
        `${((width - FACE_WIDTH * scale) / 2).toFixed(2)}px`,
      );
      stage.style.setProperty(
        "--face-y",
        `${((height - FACE_HEIGHT * scale) / 2).toFixed(2)}px`,
      );
    };

    updateFaceGeometry();
    const observer = new ResizeObserver(updateFaceGeometry);
    observer.observe(shell);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const blinkLayer = stage.querySelector<HTMLElement>(
      ".aurora-stage__eye-plane--blink",
    );
    const irisRig = stage.querySelector<HTMLElement>(
      ".aurora-stage__iris-rig",
    );
    const gazeLayer = stage.querySelector<HTMLElement>(
      ".aurora-stage__gaze",
    );
    const commandShortcuts = stage.querySelectorAll<HTMLElement>(
      ".aurora-stage__commands [data-aurora-shortcut]",
    );

    if (!blinkLayer || !irisRig || !gazeLayer) return;

    const scope = createScope({ root: stage }).add(() => {
      irisMotionRef.current = createAnimatable(irisRig, {
        translateX: { unit: "px", duration: 260, ease: "out(3)" },
        translateY: { unit: "px", duration: 280, ease: "out(3)" },
      });

      if (commandShortcuts.length > 0 && !reduceMotion) {
        animate(commandShortcuts, {
          opacity: [0, 1],
          translateY: [10, 0],
          scale: [0.97, 1],
          delay: stagger(70),
          duration: 520,
          ease: "out(4)",
        });
      }
    });

    let blinkTimer: number | null = null;
    let consecutiveBlinks = 0;
    const blinkTimeline = createTimeline({
      autoplay: false,
      defaults: { ease: "inOutQuad" },
      onComplete: () => {
        const doubleBlink = consecutiveBlinks === 0 && Math.random() < 0.18;
        consecutiveBlinks = doubleBlink ? 1 : 0;
        scheduleBlink(doubleBlink ? 150 : 4200 + Math.random() * 3600);
      },
    })
      .add(gazeLayer, { opacity: 0, duration: 55 }, 0)
      .add(blinkLayer, { opacity: 1, duration: 75 }, 0)
      .add(blinkLayer, { opacity: 1, duration: 55 })
      .add(blinkLayer, { opacity: 0, duration: 105 })
      .add(gazeLayer, { opacity: 1, duration: 90 }, "<");

    const scheduleBlink = (delay: number) => {
      if (reduceMotion) return;
      if (blinkTimer !== null) window.clearTimeout(blinkTimer);
      blinkTimer = window.setTimeout(() => {
        if (document.hidden) {
          scheduleBlink(1200);
          return;
        }
        blinkTimeline.restart();
      }, delay);
    };

    scheduleBlink(1800 + Math.random() * 2200);

    /* Olho humano não persegue nada de forma contínua: ele salta. As
       micro-sacadas somam um desvio pequeno ao alvo do ponteiro e o
       trocam em intervalos irregulares. */
    let saccadeTimer: number | null = null;
    const scheduleSaccade = () => {
      if (reduceMotion) return;
      saccadeTimer = window.setTimeout(
        () => {
          if (!document.hidden) {
            saccadeRef.current = {
              x: (Math.random() - 0.5) * 2 * SACCADE_RANGE,
              y: (Math.random() - 0.5) * SACCADE_RANGE,
            };
            applyGaze();
          }
          scheduleSaccade();
        },
        900 + Math.random() * 1900,
      );
    };
    scheduleSaccade();

    return () => {
      if (blinkTimer !== null) window.clearTimeout(blinkTimer);
      if (saccadeTimer !== null) window.clearTimeout(saccadeTimer);
      blinkTimeline.revert();
      irisMotionRef.current = null;
      scope.revert();
    };
  }, [applyGaze]);

  const setInteractionState = (
    state: "idle" | "listening" | "processing",
    resetAfter?: number,
  ) => {
    const stage = stageRef.current;
    if (!stage) return;

    stage.dataset.interaction = state;
    if (interactionTimerRef.current !== null) {
      window.clearTimeout(interactionTimerRef.current);
    }

    if (resetAfter) {
      interactionTimerRef.current = window.setTimeout(() => {
        stage.dataset.interaction = stage.contains(document.activeElement)
          ? "listening"
          : "idle";
      }, resetAfter);
    }
  };

  const announceCommand = useCallback(
    (command: string, action: () => void) => {
      if (isAnnouncing) return;

      const fullName =
        localStorage.getItem("nomeCompleto") ||
        localStorage.getItem("userName") ||
        "";
      const firstName = fullName.trim().split(/\s+/)[0] || "vamos lá";
      const target = commandDisplayName(command);
      const messages = [
        `Boa escolha, ${firstName}. Vou abrir ${target} agora para você.`,
        `Perfeito, ${firstName}. Já estou preparando ${target}.`,
        `Certo, ${firstName}. Vamos acessar ${target}.`,
        `Pode deixar, ${firstName}. Estou abrindo ${target}.`,
      ];

      setIsAnnouncing(true);
      setInteractionState("processing");

      const selectedMessage =
        messages[Math.floor(Math.random() * messages.length)];
      setAnnouncement(selectedMessage);
      const typingDuration = getTypingDuration(selectedMessage);
      announcementTimerRef.current = window.setTimeout(() => {
        action();
        announcementResetTimerRef.current = window.setTimeout(() => {
          setAnnouncement(null);
          setIsAnnouncing(false);
          setInteractionState("idle");
        }, 500);
      }, typingDuration + 480);
    },
    [isAnnouncing],
  );

  const interactionController = useMemo(
    () => ({ announceCommand, isAnnouncing }),
    [announceCommand, isAnnouncing],
  );

  const updateParallax = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const bounds = stage.getBoundingClientRect();
    const x = clamp((clientX - bounds.left) / bounds.width - 0.5, -0.5, 0.5);
    const y = clamp((clientY - bounds.top) / bounds.height - 0.5, -0.5, 0.5);

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      stage.style.setProperty("--pointer-x", x.toFixed(3));
      stage.style.setProperty("--pointer-y", y.toFixed(3));
      gazeTargetRef.current = { x, y };
      applyGaze();
    });
  };

  const resetParallax = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--pointer-x", "0");
    stage.style.setProperty("--pointer-y", "0");
    gazeTargetRef.current = { x: 0, y: 0 };
    saccadeRef.current = { x: 0, y: 0 };
    applyGaze();
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        updateParallax(event.clientX, event.clientY);
      }
    };
    const handlePointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) resetParallax();
    };
    const handleWindowBlur = () => resetParallax();

    // Capture no window mantém o olhar ativo sobre cards, headers, comandos
    // e conteúdos renderizados em portals fora da árvore do palco.
    window.addEventListener("pointermove", handlePointerMove, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerout", handlePointerOut, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerout", handlePointerOut, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  });

  return (
    <main
      ref={stageRef}
      className="aurora-stage"
      onFocusCapture={() => setInteractionState("listening")}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setInteractionState("idle");
        }
      }}
      onInputCapture={() => setInteractionState("listening")}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('[aria-label="Executar comando"]')) {
          setInteractionState("processing", 1800);
        }
      }}
      data-interaction="idle"
    >
      <div className="aurora-stage__backdrop" aria-hidden="true">
        <img
          src={ART_FACE}
          alt=""
          className="aurora-stage__base"
          draggable={false}
        />
        <div
          className="aurora-stage__face-shell"
          ref={faceShellRef}
          data-tour="aurora"
        >
          <img
            src={ART_FACE}
            alt=""
            className="aurora-stage__face"
            draggable={false}
          />
          <div className="aurora-stage__eye-rig">
            {/* 1. leito: esclera vazia, cobre a íris original e não se move */}
            <div className="aurora-stage__eye-plane aurora-stage__eye-plane--bed">
              <img
                src={ART_EYE_BED}
                alt=""
                className="aurora-stage__eye-art"
                draggable={false}
              />
            </div>
            {/* 2. íris: recortada da arte principal e reposicionada sobre o
                leito; a abertura do plano impede que ela escape da pálpebra */}
            <div className="aurora-stage__eye-plane aurora-stage__eye-plane--iris">
              <div className="aurora-stage__iris-rig">
                <img
                  src={ART_FACE}
                  alt=""
                  className="aurora-stage__eye-art"
                  draggable={false}
                />
                <div className="aurora-stage__gaze">
                  <span className="aurora-stage__gaze-point aurora-stage__gaze-point--left" />
                  <span className="aurora-stage__gaze-point aurora-stage__gaze-point--right" />
                </div>
              </div>
            </div>
            {/* 3. piscada */}
            <div className="aurora-stage__eye-plane aurora-stage__eye-plane--blink">
              <img
                src={ART_EYES_CLOSED}
                alt=""
                className="aurora-stage__eye-art"
                draggable={false}
              />
            </div>
          </div>
        </div>
        <div className="aurora-stage__orbit aurora-stage__orbit--outer" />
        <div className="aurora-stage__orbit aurora-stage__orbit--inner" />
        <div className="aurora-stage__particles" />
        <div className="aurora-stage__command-wash" />
      </div>

      <div className="aurora-stage__content">
        <div
          ref={introRef}
          className={`aurora-stage__intro ${
            announcement ? "aurora-stage__intro--announcement" : ""
          }`}
          aria-live="polite"
        >
          {announcement ? (
            <>
              <h1
                className="aurora-stage__glitch-text"
                data-text={displayedAnnouncement}
              >
                {displayedAnnouncement}
                <span className="aurora-stage__typewriter-cursor" aria-hidden="true" />
              </h1>
              <p>Só um instante...</p>
            </>
          ) : (
            <>
              <h1>
                Olá, eu sou a <span>Aurora.</span>
              </h1>
              <p>Como posso ajudar você hoje?</p>
            </>
          )}
        </div>

        <AuroraInteractionContext.Provider value={interactionController}>
          <div
            className={`aurora-stage__commands ${
              isAnnouncing ? "aurora-stage__commands--announcing" : ""
            }`}
          >
            {children}
          </div>
        </AuroraInteractionContext.Provider>

        <div className="aurora-stage__status">
          <span aria-hidden="true" />
          {statusText}
        </div>
      </div>
    </main>
  );
};

export default AuroraStage;
