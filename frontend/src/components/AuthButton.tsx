import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  Headset,
  PhoneCall,
  Mic,
  User,
  User2,
  UserCheck,
  UserCircle2,
  Users,
  UserPlus,
  Smile,
  Heart,
  ThumbsUp,
  Sun,
  Moon,
  Star,
  Zap,
  Paintbrush,
  Wand2,
  Ghost,
  Flame,
  Music,
  Gamepad2,
  Settings,
  Calendar,
  Clock,
  Bell,
  FileText,
  FolderOpen,
  MessageCircle,
  LogOut,
  Check,
  Video,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import axiosInstance from "@/utils/axiosInstance";

const iconCategories = [
  {
    title: "Operador",
    icons: [
      { label: "Atendente", icon: Headset, color: "bg-blue-100 text-blue-700" },
      {
        label: "Ligação",
        icon: PhoneCall,
        color: "bg-green-100 text-green-700",
      },
      { label: "Microfone", icon: Mic, color: "bg-purple-100 text-purple-700" },
    ],
  },
  {
    title: "Perfis",
    icons: [
      { label: "Usuário", icon: User, color: "bg-slate-100 text-slate-700" },
      { label: "Usuário 2", icon: User2, color: "bg-pink-100 text-pink-700" },
      {
        label: "Verificado",
        icon: UserCheck,
        color: "bg-orange-100 text-orange-700",
      },
      {
        label: "Perfil",
        icon: UserCircle2,
        color: "bg-yellow-100 text-yellow-700",
      },
      { label: "Grupo", icon: Users, color: "bg-sky-100 text-sky-700" },
      { label: "Novo", icon: UserPlus, color: "bg-lime-100 text-lime-700" },
    ],
  },
  {
    title: "Fun & Emoção",
    icons: [
      { label: "Sorriso", icon: Smile, color: "bg-teal-100 text-teal-700" },
      { label: "Coração", icon: Heart, color: "bg-red-100 text-red-700" },
      { label: "Like", icon: ThumbsUp, color: "bg-blue-100 text-blue-700" },
      { label: "Sol", icon: Sun, color: "bg-yellow-100 text-yellow-700" },
      { label: "Lua", icon: Moon, color: "bg-indigo-100 text-indigo-700" },
      { label: "Estrela", icon: Star, color: "bg-orange-100 text-orange-700" },
    ],
  },
  {
    title: "Criatividade",
    icons: [
      { label: "Pincel", icon: Paintbrush, color: "bg-pink-100 text-pink-700" },
      { label: "Mágica", icon: Wand2, color: "bg-violet-100 text-violet-700" },
      { label: "Fantasma", icon: Ghost, color: "bg-gray-200 text-gray-700" },
      { label: "Fogo", icon: Flame, color: "bg-red-200 text-red-800" },
      { label: "Música", icon: Music, color: "bg-blue-200 text-blue-800" },
      {
        label: "Gamepad",
        icon: Gamepad2,
        color: "bg-purple-200 text-purple-800",
      },
    ],
  },
  {
    title: "Funcional",
    icons: [
      {
        label: "Configuração",
        icon: Settings,
        color: "bg-slate-200 text-slate-800",
      },
      {
        label: "Calendário",
        icon: Calendar,
        color: "bg-orange-200 text-orange-800",
      },
      { label: "Relógio", icon: Clock, color: "bg-amber-100 text-amber-700" },
      { label: "Alerta", icon: Bell, color: "bg-yellow-200 text-yellow-800" },
      { label: "Arquivo", icon: FileText, color: "bg-gray-300 text-gray-800" },
      {
        label: "Pasta",
        icon: FolderOpen,
        color: "bg-yellow-300 text-yellow-900",
      },
    ],
  },
  {
    title: "Avatares",
    icons: [
      { label: "Garoto", image: "/avatares/Avatar1.png" },
      { label: "Heroína", image: "/avatares/Avatar2.png" },
      { label: "Heroína 2", image: "/avatares/Avatar3.png" },
      { label: "Soldado", image: "/avatares/Avatar4.png" },
      { label: "Hulk", image: "/avatares/Avatar5.png" },
      { label: "Garoto 2", image: "/avatares/Avatar6.png" },
      { label: "Operador", image: "/avatares/Avatar7.png" },
      { label: "Operadora", image: "/avatares/Avatar8.png" },
      { label: "Garota", image: "/avatares/Avatar9.png" },
    ],
  },
];

const frasesMotivacionais = [
  "Você é a ponte entre o problema e a solução.",
  "Cada ligação é uma oportunidade.",
  "Você faz a diferença com cada palavra.",
  "Confiança é construída ligação por ligação.",
  "Seu esforço é ouvido — literalmente!",
  "Continue, você está indo muito bem.",
  "Cada ‘não’ te aproxima de um ‘sim’.",
  "Seja a voz que ajuda e resolve.",
  "Você é a energia positiva da central!",
  "O sucesso é feito de constância e paciência.",
  "Você é a peça-chave do atendimento!",
  "Seu trabalho é essencial.",
  "Ouça com atenção, fale com empatia.",
  "A conexão que você cria vai além da linha.",
  "Um sorriso se escuta, mesmo por telefone.",
  "Você é mais importante do que imagina.",
  "Quem ajuda, colhe gratidão.",
  "Seu atendimento é a imagem da empresa.",
  "Foco, força e fone!",
  "A sua voz move resultados.",
  "Você é bom no que faz.",
  "Empatia gera confiança.",
  "Você está escrevendo sua história profissional.",
  "Seja o atendimento que você gostaria de receber.",
  "Persistência constrói excelência.",
  "Grandes operadores são grandes ouvintes.",
  "Você está no caminho certo.",
  "Seus clientes sentem sua dedicação.",
  "O cliente lembra quem o escutou bem.",
  "A meta de hoje é superável!",
  "Atender bem é uma arte. E você é artista.",
  "A voz certa no momento certo muda tudo.",
  "Você é inspiração para os colegas.",
  "Cada contato é uma chance de brilhar.",
  "Orgulhe-se do seu desempenho!",
  "Desafios são oportunidades disfarçadas.",
  "A cada dia, você melhora mais.",
  "Você está crescendo. Continue.",
  "Você não está sozinho. Somos um time.",
  "Seu valor vai além dos ideais.",
  "Com atitude positiva, tudo melhora.",
  "A excelência começa na escuta.",
  "Você pode mais do que imagina.",
  "A jornada importa tanto quanto o resultado.",
  "Cada cliente é único. E você também.",
  "Trate cada chamada como a mais importante.",
  "Sua energia influencia quem te ouve.",
  "Siga com garra e bom humor.",
  "Seja motivo de orgulho para você mesmo.",
  "Você transforma experiências!",
];

export const allIcons = iconCategories.flatMap((cat) => cat.icons);

const AuthButton = ({
  isInsideHamburguer = false,
  visualVariant = "default",
}: {
  isInsideHamburguer?: boolean;
  visualVariant?: "default" | "aurora";
}) => {
  const isAurora = visualVariant === "aurora";
  const navigate = useNavigate();
  const userName = localStorage.getItem("nomeCompleto") || "Usuário";
  const [selectedIcon, setSelectedIcon] = useState(
    parseInt(localStorage.getItem("selectedIcon") || "0")
  );

  const SelectedIconComponent = allIcons[selectedIcon].icon;
  const SelectedIconImage = allIcons[selectedIcon].image;

  useEffect(() => {
    if (SelectedIconImage) {
      localStorage.setItem("selectedAvatar", SelectedIconImage);
    } else {
      localStorage.removeItem("selectedAvatar");
    }
  }, [SelectedIconImage]);

  const [frase, setFrase] = useState("");

  const handleLogout = async () => {
    const token = localStorage.getItem("userToken");
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      await axiosInstance.post(
        "/api/auth/logout", // corpo vazio
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Erro ao deslogar no backend:", error);
    }

    localStorage.clear();
    navigate("/login");
  };

  const handleIconSelect = (index: number) => {
    setSelectedIcon(index);
    localStorage.setItem("selectedIcon", index.toString());
    const selectedAvatar = allIcons[index].image;

    if (selectedAvatar) {
      localStorage.setItem("selectedAvatar", selectedAvatar);
    } else {
      localStorage.removeItem("selectedAvatar");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const aleatoria =
        frasesMotivacionais[
          Math.floor(Math.random() * frasesMotivacionais.length)
        ];
      setFrase(aleatoria);
    }
  };

  const [showVideo, setShowVideo] = useState(false);

  const toggleVideo = () => setShowVideo((prev) => !prev);

  return (
    <>
      {showVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-4xl relative border border-slate-200 dark:bg-gray-900 dark:border-slate-900"
          >
            <button
              onClick={toggleVideo}
              className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition text-xl font-bold"
              title="Fechar"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-4 text-sky-600">
              <Video className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Como utilizar o sistema</h2>
            </div>

            <div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-slate-200">
              <video
                controls
                controlsList="nodownload"
                preload="metadata"
                className="w-full h-auto max-h-[70vh] object-contain rounded-xl"
              >
                <source src="/videos/Copilot.mkv" type="video/x-matroska" />
                Seu navegador não suporta a tag de vídeo.
              </video>
            </div>
          </motion.div>
        </div>
      )}
      <div
        className={cn(
          isInsideHamburguer ? "flex flex-col gap-3" : "flex items-center gap-3"
        )}
      >
        <DropdownMenu onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-3 text-sm",
                isInsideHamburguer &&
                  "h-auto w-full min-w-0 justify-start rounded-2xl px-3 py-3",
                isAurora &&
                  "border border-blue-300/25 bg-blue-300/[0.06] text-slate-100 hover:border-blue-300/30 hover:bg-blue-300/[0.1] hover:text-white"
              )}
            >
              <div
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full",
                  allIcons[selectedIcon].color,
                  isAurora &&
                    "ring-1 ring-blue-200/25 shadow-[0_0_18px_rgba(34,211,238,0.16)]"
                )}
              >
                {SelectedIconImage ? (
                  <img
                    src={SelectedIconImage}
                    alt="Avatar"
                    className="size-full object-cover"
                  />
                ) : (
                  <SelectedIconComponent className="size-5" />
                )}
              </div>

              <span
                className={cn(
                  "min-w-0",
                  isInsideHamburguer && "truncate font-medium"
                )}
              >
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className={cn(
              "w-64 max-h-[60vh] space-y-3 overflow-y-auto rounded-xl border p-3 shadow-lg",
              isAurora &&
                "border-blue-300/20 bg-[#07111f]/95 text-slate-100 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            )}
          >
            {frase && (
              <div className={cn(
                "mb-2 border-l-4 border-sky-400 pl-2 text-xs italic text-sky-600",
                isAurora && "text-blue-200"
              )}>
                {frase}
              </div>
            )}
            <div className={cn(
              "mb-1 text-xs font-semibold text-muted-foreground",
              isAurora && "uppercase tracking-[0.16em] text-slate-400"
            )}>
              Escolha seu ícone
            </div>
            <Accordion type="single" collapsible className="w-full">
              {iconCategories.map((category, catIdx) => (
                <AccordionItem key={catIdx} value={`cat-${catIdx}`}>
                  <AccordionTrigger>{category.title}</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-3 gap-2 pt-2">
                    {category.icons.map((icon, idx) => {
                      const index =
                        iconCategories
                          .slice(0, catIdx)
                          .reduce((acc, c) => acc + c.icons.length, 0) + idx;

                      return (
                        <button
                          key={index}
                          onClick={() => handleIconSelect(index)}
                          className={cn(
                            "rounded-full p-2 flex items-center justify-center border-2 transition",
                            index === selectedIcon
                              ? "border-sky-500"
                              : "border-transparent hover:border-slate-300",
                            icon.color || "bg-white"
                          )}
                          title={icon.label}
                        >
                          {icon.image ? (
                            <img
                              src={icon.image}
                              alt={icon.label}
                              className="w-auto h-6 rounded-full"
                            />
                          ) : (
                            <icon.icon className="w-5 h-5" />
                          )}
                        </button>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleVideo}
          className={cn(
            "transition",
            isInsideHamburguer && "h-11 w-full justify-start rounded-xl px-4",
            isAurora
              ? "border border-transparent text-blue-200 hover:border-blue-300/20 hover:bg-blue-300/[0.08] hover:text-blue-100"
              : "text-orange-600 hover:bg-blue-50 hover:text-blue-800"
          )}
          title="Como utilizar"
        >
          <Video className="h-4 w-4 mr-1" />
          Como Utilizar
        </Button>

        <Button
          variant="ghost"
          className={cn(
            "transition",
            isInsideHamburguer && "h-11 w-full justify-start rounded-xl px-4",
            isAurora
              ? "border border-transparent text-sky-200 hover:border-sky-300/20 hover:bg-sky-300/[0.08] hover:text-white"
              : "text-red-500 hover:bg-red-50 hover:text-red-700"
          )}
          onClick={() =>
            window.open("https://news.empresa.local:8383", "_blank")
          }
        >
          <Newspaper className="w-4 h-4" />
          Acme News
        </Button>

        <Button
          variant="ghost"
          className={cn(
            "transition",
            isInsideHamburguer && "h-11 w-full justify-start rounded-xl px-4",
            isAurora
              ? "border border-transparent text-sky-200 hover:border-sky-300/20 hover:bg-sky-300/[0.08] hover:text-white"
              : "text-red-500 hover:bg-red-50 hover:text-red-700"
          )}
          onClick={() =>
            window.open("https://www.portalacordo.example/", "_blank")
          }
        >
          <Newspaper className="w-4 h-4" />
          PortalAcordo!
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "transition",
            isInsideHamburguer &&
              "mt-2 h-11 w-full justify-start rounded-xl border px-4",
            isAurora
              ? "border-red-400/15 bg-red-400/[0.04] text-red-300 hover:border-red-300/25 hover:bg-red-400/[0.1] hover:text-red-200"
              : "border-transparent text-red-500 hover:bg-red-50 hover:text-red-700"
          )}
        >
          <LogOut className="h-4 w-4 mr-1" />
          Sair
        </Button>
      </div>
    </>
  );
};

export default AuthButton;
