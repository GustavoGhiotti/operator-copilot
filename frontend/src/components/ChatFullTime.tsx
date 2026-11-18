import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Image as ImageIcon,
  Users,
  Settings,
  MoreVertical,
  UserPlus,
  UserMinus,
  Trash2,
  Hash,
  Crown,
  User,
  Search,
  Plus,
  Edit3,
  Lock,
  Unlock,
  MessageSquare,
  AtSign,
  ArrowDown,
  ChevronRight,
  Copy,
  FileText,
  GraduationCap,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Reply,
  ShieldCheck,
  Sparkles,
  Wifi,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import * as leoProfanity from "leo-profanity";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axiosInstance from "@/utils/axiosInstance";
import { blockedWords } from "@/config/blocked-words";
import { io, type ManagerOptions, type SocketOptions } from "socket.io-client";
import ReactQuill from "react-quill";
import { quillFormats, quillModules } from "./RoteiroFluxoBuilderModal";

interface ChatUser {
  id: string;
  nome: string;
  avatar?: string;
  role: "admin" | "supervisor" | "operador";
  carteira: string;
  status: "online" | "offline" | "away";
  last_seen?: string;
}

interface ChatRoom {
  id: string;
  nome: string;
  descricao?: string;
  tipo: "geral" | "carteira" | "privado";
  criado_por: string;
  carteira?: string;
  membros: ChatUser[];
  created_at: string;
  is_active: boolean;
}

interface ChatMessage {
  id: string;
  sala_id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_avatar?: string;
  usuario_role: "admin" | "supervisor" | "operador";
  conteudo: string;
  tipo: "texto" | "imagem" | "sistema" | "quiz";
  imagem_url?: string;
  timestamp: string;
  editado?: boolean;
  editado_em?: string;
  fixada?: boolean;
  resposta?: {
    id: string;
    conteudo: string;
    tipo: string;
    usuario_nome: string;
  } | null;
  reacoes?: Array<{
    emoji: string;
    quantidade: number;
    usuarios: string[];
  }>;

  // 👇 extras para quiz
  quiz_id?: string;
  alternativas?: string[];
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RoomContextTab = "membros" | "fixadas" | "arquivos" | "quizzes";

const ContextEmptyState = ({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) => (
  <div className="rounded-xl border border-dashed border-[#29445f] bg-[#07111f]/70 px-4 py-7 text-center">
    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white/[0.035] text-slate-400">
      {icon}
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-slate-400">{text}</p>
  </div>
);

const BLOCKED_CHAT_EMOJIS = [
  "🖕",
  "🍆",
  "🐒",
  "🐵",
  "🦍",
  "🙈",
  "🙉",
  "🙊",
  "🇮🇱",
  "🚬",
  "💦",
] as const;
const BLOCKED_CHAT_EMOJI_MASK = "🚫";

const censorBlockedEmojis = (text?: string | null) => {
  if (!text) return text ?? "";

  let sanitizedText = text;

  BLOCKED_CHAT_EMOJIS.forEach((emoji) => {
    sanitizedText = sanitizedText.split(emoji).join(BLOCKED_CHAT_EMOJI_MASK);
  });

  return sanitizedText;
};

const isBlockedEmoji = (emoji: string) =>
  BLOCKED_CHAT_EMOJIS.includes(emoji as (typeof BLOCKED_CHAT_EMOJIS)[number]);

const getPlainTextFromComposer = (value = "") =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const chatComposerQuillStyles = `
  .chat-composer-quill {
    font-family: inherit;
  }

.chat-composer-quill {
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
}
.chat-composer-quill .ql-toolbar {
  border: none;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.35);
  padding: 0.5rem 0.725rem;
  font-family: inherit;
}

.chat-composer-quill .ql-container {
  min-height: 55px;
  max-height: 7rem;
  border: none;
  border-radius: 0 0 0.75rem 0.75rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: inherit;
  overflow: hidden;
}

.chat-composer-quill .ql-editor {
  min-height: 40px;
  max-height: 7rem;
  overflow-y: auto;
  padding: 1.25rem 2.5rem 0.5rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: hsl(var(--foreground));
  box-sizing: border-box;
  font-family: inherit;
}

.chat-composer-quill .ql-editor.ql-blank::before {
  color: hsl(var(--muted-foreground));
  font-style: normal;
  left: 0.75rem;
  right: 2.5rem;
}

.chat-composer-quill .ql-toolbar .ql-picker {
  position: relative;
}

.chat-composer-quill .ql-toolbar .ql-picker-options {
  top: auto !important;
  bottom: calc(100% + 0.4rem) !important;
  left: 0;
  z-index: 90;
  max-height: 14rem;
  overflow-y: auto;
  border-color: hsl(var(--border));
  background: hsl(var(--background));
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
}

.room-description-quill .ql-container,
.room-description-quill .ql-editor {
  max-height: 8rem;
}
`;

const getStoredUserRole = (): ChatUser["role"] => {
  if (localStorage.getItem("userIsAdmin") === "true") {
    return "admin";
  }

  const funcao = (localStorage.getItem("funcao") || "").toLowerCase();

  if (
    funcao.includes("super") ||
    funcao.includes("coord") ||
    funcao.includes("gerente")
  ) {
    return "supervisor";
  }

  return "operador";
};

const CHAT_BASE_PATHS = ["/api/chat", "/chat"] as const;

const ChatFullTime: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
  // Estados principais
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Estados da interface
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados dos modais
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showRoomContext, setShowRoomContext] = useState(true);
  const [roomContextTab, setRoomContextTab] =
    useState<RoomContextTab>("membros");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<
    string | null
  >(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [auroraNotice, setAuroraNotice] = useState<string | null>(null);

  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [quizTimer, setQuizTimer] = useState<number | null>(null);
  const [quizResults, setQuizResults] = useState<Record<string, any>>({});

  const [newQuiz, setNewQuiz] = useState({
    pergunta: "",
    alternativas: [""], // array dinâmico
    correta: "",
    tempo_limite: 600, // default 10min
  });

  const socketRef = useRef<any>(null);
  const chatBaseRef = useRef<(typeof CHAT_BASE_PATHS)[number] | null>(null);
  const currentUserRef = useRef<ChatUser | null>(null);
  const activeRoomRef = useRef<ChatRoom | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isNearBottomRef = useRef(true);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const typingUserTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const lastTypingEmitRef = useRef(0);
  const auroraNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  useEffect(() => {
    leoProfanity.clearList();
    leoProfanity.add(blockedWords);
  }, []);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      Object.values(typingUserTimeoutsRef.current).forEach(clearTimeout);
      if (auroraNoticeTimeoutRef.current) {
        clearTimeout(auroraNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeQuiz?.tempo_limite) return;
    setQuizTimer(activeQuiz.tempo_limite);
    const interval = setInterval(() => {
      setQuizTimer((t) => (t && t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeQuiz]);

  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on("message_pinned", (data: any) => {
      if (data.sala_id === activeRoom?.id) {
        setPinnedMessage({
          ...data.mensagem,
          conteudo: censorBlockedEmojis(data.mensagem?.conteudo),
        });
      }
    });

    socketRef.current.on("message_unpinned", (data: any) => {
      if (data.sala_id === activeRoom?.id) {
        setPinnedMessage(null);
      }
    });

    return () => {
      socketRef.current?.off("message_pinned");
      socketRef.current?.off("message_unpinned");
    };
  }, [activeRoom]);

  const loadAllUsers = async () => {
    try {
      const response = await requestChat<ChatUser[]>("get", "/users/all");
      setAllUsers(response.data);
    } catch (error) {
      console.error("Erro ao carregar todos os usuários:", error);
      setAllUsers([]);
    }
  };

  const showAuroraMessage = (message: string) => {
    setAuroraNotice(message);
    if (auroraNoticeTimeoutRef.current) {
      clearTimeout(auroraNoticeTimeoutRef.current);
    }
    auroraNoticeTimeoutRef.current = setTimeout(() => {
      setAuroraNotice(null);
    }, 3200);
  };

  const getDraftStorageKey = (roomId: string) =>
    `copilot-chat-draft:${localStorage.getItem("nomeCompleto") || "usuario"}:${roomId}`;

  const getReadStorageKey = (roomId: string) =>
    `copilot-chat-read:${localStorage.getItem("nomeCompleto") || "usuario"}:${roomId}`;

  const persistDraft = (value: string) => {
    const room = activeRoomRef.current;
    if (!room) return;
    const key = getDraftStorageKey(room.id);
    if (getPlainTextFromComposer(value)) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  };

  const emitTypingState = (typing: boolean) => {
    const room = activeRoomRef.current;
    const user = currentUserRef.current;
    if (!socketRef.current?.connected || !room || !user) return;
    socketRef.current.emit("typing", {
      sala_id: room.id,
      usuario_nome: user.nome,
      typing,
    });
  };

  const scheduleTypingSignal = (hasContent: boolean) => {
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }
    if (!hasContent) {
      emitTypingState(false);
      return;
    }

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 500) {
      emitTypingState(true);
      lastTypingEmitRef.current = now;
    }
    typingStopTimeoutRef.current = setTimeout(() => {
      emitTypingState(false);
    }, 1200);
  };

  const handleInputChange = (
    e: string | React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    let value = "";
    if (typeof e === "string") {
      value = censorBlockedEmojis(e);
    } else {
      value = censorBlockedEmojis(e.target.value);
    }
    setMessageInput(value);
    persistDraft(value);
    scheduleTypingSignal(Boolean(getPlainTextFromComposer(value)));

    const match = getPlainTextFromComposer(value).match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const unpinMessage = () => {
    if (!["admin", "supervisor"].includes(currentUser?.role || "")) {
      toast.error("Você não tem permissão para remover mensagens fixadas");
      return;
    }

    if (socketRef.current && activeRoom) {
      socketRef.current.emit("unpin_message", {
        sala_id: activeRoom.id,
        role: currentUser?.role,
      });
    }
  };

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    if (!socketRef.current) {
      const socketUrl =
        import.meta.env.VITE_SOCKET_URL?.trim() ||
        "http://copilotacme.empresa.local";

      const socketOptions: Partial<ManagerOptions & SocketOptions> = {
        path: "/socket.io",
        transports: ["polling"],
        upgrade: false,
        autoConnect: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
      };

      socketRef.current = socketUrl
        ? io(socketUrl, socketOptions)
        : io(socketOptions);

      socketRef.current.on("connect", () => {
        setIsSocketConnected(true);
        showAuroraMessage("Conexão em tempo real ativa.");
        console.log("Conectado ao servidor socket:", socketRef.current.id);

        const currentRoom = activeRoomRef.current;
        const user = currentUserRef.current;

        if (currentRoom && user) {
          socketRef.current.emit(
            "join",
            {
              sala_id: currentRoom.id,
              usuario_nome: user.nome,
            },
            (ack: any) => {
              if (ack?.status !== "ok") {
                console.warn("Falha ao reentrar na sala:", ack);
              }
            },
          );
        }
      });

      socketRef.current.on("disconnect", (reason: string) => {
        setIsSocketConnected(false);
        console.warn("Socket desconectado:", reason);
      });

      socketRef.current.on("connect_error", (error: Error) => {
        setIsSocketConnected(false);
        console.error("Erro ao conectar no socket:", error.message);
      });

      socketRef.current.on("new_message", (msg: ChatMessage) => {
        const isOwnMessage =
          msg.usuario_nome === currentUserRef.current?.nome;
        setMessages((prev) => [
          ...prev,
          {
            ...msg,
            conteudo: censorBlockedEmojis(msg.conteudo),
            imagem_url: normalizeChatAssetUrl(msg.imagem_url),
          },
        ]);

        if (isNearBottomRef.current || isOwnMessage) {
          requestAnimationFrame(() => scrollToBottom());
        } else {
          setFirstUnreadMessageId((current) => current || msg.id);
          setUnreadCount((count) => count + 1);
          showAuroraMessage(
            `Nova mensagem de ${msg.usuario_nome}.`,
          );
        }
      });

      socketRef.current.on("message_reactions_updated", (data: any) => {
        if (data.sala_id !== activeRoomRef.current?.id) return;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === data.message_id
              ? { ...message, reacoes: data.reacoes || [] }
              : message,
          ),
        );
      });

      socketRef.current.on("user_typing", (data: any) => {
        if (
          data.sala_id !== activeRoomRef.current?.id ||
          data.usuario_nome === currentUserRef.current?.nome
        ) {
          return;
        }

        const userName = String(data.usuario_nome);
        if (typingUserTimeoutsRef.current[userName]) {
          clearTimeout(typingUserTimeoutsRef.current[userName]);
        }

        if (!data.typing) {
          setTypingUsers((users) =>
            users.filter((name) => name !== userName),
          );
          return;
        }

        setTypingUsers((users) =>
          users.includes(userName) ? users : [...users, userName],
        );
        typingUserTimeoutsRef.current[userName] = setTimeout(() => {
          setTypingUsers((users) =>
            users.filter((name) => name !== userName),
          );
          delete typingUserTimeoutsRef.current[userName];
        }, 1800);
      });

      socketRef.current.on("message_pinned", (data: any) => {
        if (data.sala_id === activeRoom?.id) {
          setPinnedMessage({
            ...data.mensagem,
            conteudo: censorBlockedEmojis(data.mensagem?.conteudo),
          });
        }
      });

      socketRef.current.on("message_unpinned", (data: any) => {
        if (data.sala_id === activeRoom?.id) {
          setPinnedMessage(null);
        }
      });

      socketRef.current.on("delete_message", (msg: any) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, conteudo: msg.conteudo, tipo: msg.tipo }
              : m,
          ),
        );
      });

      socketRef.current.on("error", (payload: any) => {
        console.error("Erro recebido do socket:", payload);
      });
    }

    return () => {
      setIsSocketConnected(false);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isOpen, currentUser?.id]);

  // Estados do formulário de sala
  const [newRoom, setNewRoom] = useState({
    nome: "",
    descricao: "",
    tipo: "carteira" as const,
    carteira: localStorage.getItem("centroCusto") || "", // 👈 já puxa do localStorage
  });

  const pinMessage = (message: ChatMessage) => {
    if (!["admin", "supervisor"].includes(currentUser?.role || "")) {
      toast.error("Você não tem permissão para fixar mensagens");
      return;
    }

    if (socketRef.current && activeRoom) {
      socketRef.current.emit("pin_message", {
        sala_id: activeRoom.id,
        message_id: message.id,
        role: currentUser?.role,
      });
    }
  };

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dados do usuário atual do localStorage
  const userInfo = {
    nome: localStorage.getItem("nomeCompleto") || "",
    role: getStoredUserRole(),
    carteira: localStorage.getItem("centroCusto") || "",
  };

  const buildChatUrl = (basePath: string, path: string) =>
    `${basePath}${path.startsWith("/") ? path : `/${path}`}`;

  const requestChat = async <T = any,>(
    method: "get" | "post" | "put" | "delete",
    path: string,
    config: Record<string, any> = {},
  ) => {
    const basePaths = chatBaseRef.current
      ? [
          chatBaseRef.current,
          ...CHAT_BASE_PATHS.filter(
            (basePath) => basePath !== chatBaseRef.current,
          ),
        ]
      : [...CHAT_BASE_PATHS];

    let lastError: any;

    for (const basePath of basePaths) {
      try {
        const response = await axiosInstance.request<T>({
          ...config,
          method,
          url: buildChatUrl(basePath, path),
        });

        chatBaseRef.current = basePath;
        return response;
      } catch (error: any) {
        lastError = error;

        if (error?.response?.status !== 404) {
          throw error;
        }
      }
    }

    throw lastError;
  };

  const normalizeChatAssetUrl = (url?: string | null) => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;

    if (chatBaseRef.current === "/chat" && url.startsWith("/api/chat/")) {
      return url.replace("/api/chat/", "/chat/");
    }

    return url;
  };

  const renderMessage = (text: string) => {
    const content = getPlainTextFromComposer(censorBlockedEmojis(text));
    const escapedMentions = (activeRoom?.membros || [])
      .map((member) => `@${member.nome}`)
      .sort((a, b) => b.length - a.length)
      .map((mention) =>
        mention.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      );
    const tokenPatterns = [
      ...escapedMentions,
      "https?:\\/\\/[^\\s]+",
      "R\\$\\s?[\\d.]+,\\d{2}",
      "\\b\\d{8,14}\\b",
    ];
    const tokenRegex = new RegExp(`(${tokenPatterns.join("|")})`, "gi");

    return content.split(tokenRegex).map((part, index) => {
      if (!part) return null;

      const mentionedUser = (activeRoom?.membros || []).find(
        (member) => `@${member.nome}`.toLowerCase() === part.toLowerCase(),
      );
      if (mentionedUser) {
        return (
          <span
            key={`${part}-${index}`}
            className={
              mentionedUser.role === "admin"
                ? "font-semibold text-amber-300"
                : mentionedUser.role === "supervisor"
                  ? "font-semibold text-orange-300"
                  : "font-semibold text-cyan-300"
            }
          >
            {part}
          </span>
        );
      }

      const isUrl = /^https?:\/\//i.test(part);
      const isOperationalData =
        /^R\$/i.test(part) || /^\d{8,14}$/.test(part);
      if (!isUrl && !isOperationalData) {
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      }

      return (
        <span
          key={`${part}-${index}`}
          className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 align-middle text-cyan-200"
        >
          {isUrl ? (
            <a
              href={part}
              target="_blank"
              rel="noreferrer"
              className="max-w-[360px] truncate underline decoration-cyan-300/40 underline-offset-2"
            >
              {part}
            </a>
          ) : (
            <span>{part}</span>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(part);
              toast.success("Copiado");
            }}
            className="rounded p-0.5 text-cyan-300 hover:bg-white/10 hover:text-white"
            title="Copiar"
          >
            <Copy className="h-3 w-3" />
          </button>
        </span>
      );
    });
  };

  // Funções de inicialização
  useEffect(() => {
    if (isOpen) {
      initializeChat();
    }
  }, [isOpen]);

  useEffect(() => {
    if (showRoomSettings) return;
    if (!activeRoom) return;

    const updatedActiveRoom = rooms.find((room) => room.id === activeRoom.id);

    if (updatedActiveRoom && updatedActiveRoom !== activeRoom) {
      setActiveRoom(updatedActiveRoom);
    }
  }, [rooms, activeRoom, showRoomSettings]);

  const initializeChat = async () => {
    setIsLoading(true);
    try {
      const user = await loadCurrentUser();

      await Promise.all([
        loadRooms(user.nome, user.role),
        loadOnlineUsers(),
        loadAllUsers(),
      ]);
    } catch (error) {
      console.error("Erro ao inicializar chat:", error);
      toast.error("Erro ao carregar chat");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentUser = async (): Promise<ChatUser> => {
    try {
      const response = await requestChat<ChatUser>("get", "/user/profile", {
        params: {
          nome: userInfo.nome,
          role: userInfo.role,
          carteira: userInfo.carteira,
        },
      });
      setCurrentUser(response.data);
      return response.data;
    } catch (error) {
      const fallbackUser: ChatUser = {
        id: "user-1",
        nome: userInfo.nome,
        role: userInfo.role,
        carteira: userInfo.carteira,
        status: "online",
      };

      setCurrentUser(fallbackUser);
      return fallbackUser;
    }
  };

  const loadRooms = async (usuario = userInfo.nome, role = userInfo.role) => {
    try {
      const response = await requestChat<ChatRoom[]>("get", "/rooms", {
        params: {
          carteira: userInfo.carteira,
          usuario,
          role,
        },
      });
      setRooms(response.data);
    } catch (error: any) {
      console.error("Erro ao carregar salas:", error);
      toast.error(error?.response?.data?.erro || "Erro ao carregar salas");
    }
  };
  const loadOnlineUsers = async () => {
    try {
      const response = await requestChat<ChatUser[]>("get", "/users/online", {
        params: { carteira: userInfo.carteira },
      });
      setOnlineUsers(response.data);
    } catch (error) {
      // Mock online users
      setOnlineUsers([
        {
          id: "user-1",
          nome: userInfo.nome,
          role: userInfo.role,
          carteira: userInfo.carteira,
          status: "online",
        },
      ]);
    }
  };

  const selectRoom = async (room: ChatRoom) => {
    if (!currentUser) return;

    if (socketRef.current && socketRef.current.connected && activeRoom) {
      emitTypingState(false);
      socketRef.current.emit("leave", {
        sala_id: activeRoom.id,
        usuario_nome: currentUser.nome,
      });
    }

    try {
      const response = await requestChat<ChatMessage[]>(
        "get",
        `/rooms/${room.id}/messages`,
      );
      let allMessages: ChatMessage[] = (response.data || []).map((message) => ({
        ...message,
        conteudo: censorBlockedEmojis(message.conteudo),
        imagem_url: normalizeChatAssetUrl(message.imagem_url),
      }));

      let quizMessages: ChatMessage[] = [];

      try {
        const quizzesRes = await requestChat<any[]>(
          "get",
          `/rooms/${room.id}/quizzes`,
        );

        quizMessages = (quizzesRes.data || []).map((quiz: any) => {
          if (quiz.encerrado) {
            setQuizResults((prev) => ({
              ...prev,
              [quiz.quiz_id]: {
                correta: quiz.correta,
                totais: [],
              },
            }));
          }

          return {
            id: `quiz-${quiz.quiz_id}`,
            sala_id: room.id,
            usuario_id: "system",
            usuario_nome: "Aurora Quiz",
            usuario_role: "supervisor",
            conteudo: quiz.pergunta,
            tipo: "quiz",
            timestamp: quiz.created_at,
            quiz_id: quiz.quiz_id,
            alternativas: quiz.alternativas,
          };
        });
      } catch (error) {
        console.error("Erro ao carregar quizzes da sala:", error);
      }

      allMessages = [...allMessages, ...quizMessages].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const lastReadAt = localStorage.getItem(getReadStorageKey(room.id));
      const unreadMessages = lastReadAt
        ? allMessages.filter(
            (message) =>
              message.tipo !== "quiz" &&
              new Date(message.timestamp).getTime() >
                new Date(lastReadAt).getTime() &&
              message.usuario_nome !== currentUser.nome,
          )
        : [];

      setPinnedMessage(allMessages.find((message) => message.fixada) ?? null);
      setMessages(allMessages);
      setActiveRoom(room);
      setReplyingTo(null);
      setTypingUsers([]);
      setMessageInput(localStorage.getItem(getDraftStorageKey(room.id)) || "");
      setFirstUnreadMessageId(unreadMessages[0]?.id || null);
      setUnreadCount(unreadMessages.length);
      const roomStartsAtBottom = unreadMessages.length === 0;
      setIsNearBottom(roomStartsAtBottom);
      isNearBottomRef.current = roomStartsAtBottom;
      requestAnimationFrame(() => {
        if (unreadMessages[0]) {
          messageRefs.current[unreadMessages[0].id]?.scrollIntoView({
            block: "center",
          });
        } else {
          scrollToBottom("auto");
        }
      });

      if (!socketRef.current) return;

      if (!socketRef.current.connected) {
        if (!socketRef.current.active) {
          socketRef.current.connect?.();
        }
        return;
      }

      socketRef.current.emit(
        "join",
        { sala_id: room.id, usuario_nome: currentUser.nome },
        (ack: any) => {
          if (ack?.status !== "ok") {
            console.warn(
              "Sala aberta sem sincronização em tempo real:",
              ack?.erro || ack,
            );
          }
        },
      );
    } catch (error) {
      toast.error("Erro ao carregar mensagens");
    }
  };

  useEffect(() => {
    if (!socketRef.current || !activeRoom) return;

    const handler = (msg: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, conteudo: msg.conteudo, tipo: msg.tipo }
            : m,
        ),
      );
    };

    socketRef.current.on("delete_message", handler);

    return () => {
      socketRef.current?.off("delete_message", handler);
    };
  }, [socketRef.current, activeRoom]);

  // Funções de mensagem
  const sendMessage = async () => {
    const plainMessageInput = getPlainTextFromComposer(messageInput);
    if (!plainMessageInput || !activeRoom || !currentUser) return;

    // 🚨 Checagem automática
    if (leoProfanity.check(plainMessageInput)) {
      toast.error("Mensagem contém termos proibidos 🚫");
      setMessageInput("");
      return;
    }

    const payload = {
      sala_id: activeRoom.id,
      usuario_nome: currentUser.nome,
      usuario_role: currentUser.role,
      carteira: currentUser.carteira,
      conteudo: censorBlockedEmojis(messageInput),
      tipo: "texto",
      reply_to_id: replyingTo?.id || null,
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit("send_message", payload);
    } else {
      try {
        const response = await requestChat<ChatMessage>(
          "post",
          `/rooms/${activeRoom.id}/messages`,
          { data: payload },
        );
        setMessages((prev) => [
          ...prev,
          {
            ...response.data,
            conteudo: censorBlockedEmojis(response.data.conteudo),
            imagem_url: normalizeChatAssetUrl(response.data.imagem_url),
          },
        ]);
      } catch (error) {
        toast.error("Erro ao enviar mensagem");
        return;
      }
    }

    setMessageInput("");
    localStorage.removeItem(getDraftStorageKey(activeRoom.id));
    setReplyingTo(null);
    emitTypingState(false);
    if (/https?:\/\//i.test(plainMessageInput)) {
      showAuroraMessage("Link identificado e destacado na conversa.");
    }
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!activeRoom || !currentUser || message.tipo === "sistema") return;

    const payload = {
      sala_id: activeRoom.id,
      message_id: message.id,
      usuario_nome: currentUser.nome,
      emoji,
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit("toggle_reaction", payload);
      return;
    }

    try {
      const response = await requestChat<{
        message_id: string;
        reacoes: ChatMessage["reacoes"];
      }>(
        "post",
        `/rooms/${activeRoom.id}/messages/${message.id}/reactions`,
        { data: payload },
      );
      setMessages((current) =>
        current.map((item) =>
          item.id === response.data.message_id
            ? { ...item, reacoes: response.data.reacoes || [] }
            : item,
        ),
      );
    } catch (error) {
      toast.error("Não foi possível registrar a reação");
    }
  };

  const deleteMessage = (messageId: string) => {
    if (!messageId) {
      console.error("Tentativa de excluir sem messageId válido");
      return;
    }

    if (!["supervisor", "admin"].includes(currentUser?.role || "")) {
      toast.error("Você não tem permissão para excluir mensagens");
      return;
    }

    if (socketRef.current && activeRoom) {
      if (!socketRef.current.connected) {
        toast.error("Chat em tempo real indisponível no momento");
        return;
      }
      socketRef.current.emit("delete_message", {
        id: messageId,
        role: currentUser.role,
        sala_id: activeRoom.id,
      });
    }
  };

  // Funções de gerenciamento de salas
  const createRoom = async () => {
    if (!newRoom.nome.trim()) {
      toast.error("Nome da sala é obrigatório");
      return;
    }

    const roomWallet = currentUser?.carteira || userInfo.carteira;

    if (newRoom.tipo === "carteira" && !roomWallet) {
      toast.error("Carteira nao encontrada para criar a sala");
      return;
    }

    try {
      const payload = {
        ...newRoom,
        carteira: newRoom.tipo === "carteira" ? roomWallet : null,
        criado_por: currentUser?.nome,
      };

      const response = await requestChat<ChatRoom>("post", "/rooms", {
        data: payload,
      });

      setRooms((prev) => [
        ...prev,
        {
          ...response.data,
          membros: response.data.membros ?? [],
        },
      ]);
      setShowCreateRoom(false);
      setNewRoom({
        nome: "",
        descricao: "",
        tipo: "carteira",
        carteira: roomWallet,
      });
      toast.success("Sala criada com sucesso!");
    } catch (error) {
      toast.error("Erro ao criar sala");
    }
  };

  const addUserToRoom = async (userId: string) => {
    if (!activeRoom) return;

    try {
      await requestChat("post", `/rooms/${activeRoom.id}/members`, {
        data: {
          user_id: userId,
        },
      });

      // Recarregar dados da sala
      loadRooms();
      toast.success("Usuário adicionado à sala");
    } catch (error) {
      toast.error("Erro ao adicionar usuário");
    }
  };

  const removeUserFromRoom = async (userId: string) => {
    if (!activeRoom) return;

    try {
      await requestChat("delete", `/rooms/${activeRoom.id}/members/${userId}`);

      // Recarregar dados da sala
      loadRooms();
      toast.success("Usuário removido da sala");
    } catch (error) {
      toast.error("Erro ao remover usuário");
    }
  };

  // Funções utilitárias
  const markActiveRoomAsRead = () => {
    if (!activeRoom) return;
    const latestMessage = [...messagesRef.current]
      .reverse()
      .find((message) => message.tipo !== "quiz");
    if (latestMessage?.timestamp) {
      localStorage.setItem(
        getReadStorageKey(activeRoom.id),
        new Date(latestMessage.timestamp).toISOString(),
      );
    }
    setFirstUnreadMessageId(null);
    setUnreadCount(0);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setIsNearBottom(true);
    isNearBottomRef.current = true;
    window.setTimeout(markActiveRoomAsRead, behavior === "smooth" ? 280 : 0);
  };

  const handleMessagesScroll = (event: React.UIEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.scrollHeight <= target.clientHeight) return;
    const nearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 96;
    setIsNearBottom(nearBottom);
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      markActiveRoomAsRead();
    }
  };

  const scrollToPinnedMessage = () => {
    if (!pinnedMessage) return;

    const targetMessage = messages.find((message) => {
      if (pinnedMessage.id && message.id === pinnedMessage.id) {
        return true;
      }

      if (
        pinnedMessage.tipo === "imagem" &&
        pinnedMessage.imagem_url &&
        message.imagem_url === pinnedMessage.imagem_url
      ) {
        return true;
      }

      if (
        message.timestamp === pinnedMessage.timestamp &&
        message.usuario_id === pinnedMessage.usuario_id
      ) {
        return true;
      }

      return (
        message.conteudo === pinnedMessage.conteudo &&
        message.usuario_id === pinnedMessage.usuario_id
      );
    });

    if (!targetMessage) return;

    setHighlightedMessageId(targetMessage.id);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1800);

    requestAnimationFrame(() => {
      messageRefs.current[targetMessage.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const getPinnedMessagePreview = (message: ChatMessage | null) => {
    if (!message) return "";

    const preview = message.conteudo?.trim();

    if (preview) {
      return preview;
    }

    if (message.tipo === "imagem") {
      return "Imagem enviada";
    }

    return "Mensagem sem conteúdo";
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case "supervisor":
        return <Crown className="h-3 w-3 text-yellow-500" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const filteredRooms = rooms.filter((room) =>
    room.nome.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const currentOnlineUser =
    onlineUsers.find(
      (user) =>
        (currentUser?.id && user.id === currentUser.id) ||
        user.nome === currentUser?.nome,
    ) || (currentUser?.status === "online" ? currentUser : null);

  const normalizeWallet = (value?: string | null) =>
    (value || "").trim().toLowerCase();

  const availableUsers = allUsers.filter((user) => {
    if (activeRoom?.tipo !== "carteira") return true;

    return normalizeWallet(user.carteira) === normalizeWallet(activeRoom.carteira);
  });

  const canManageRoom = ["admin", "supervisor"].includes(
    currentUser?.role || "",
  );
  const recentImageMessages = messages
    .filter((message) => message.tipo === "imagem")
    .slice(-4)
    .reverse();
  const roomQuizMessages = messages
    .filter((message) => message.tipo === "quiz")
    .slice(-4)
    .reverse();

  if (!isOpen) return null;

  const editorFontSizes = [
    "12px",
    "14px",
    "16px",
    "18px",
    "24px",
    "32px",
    "48px",
  ];
  const editorFonts = [
    "arial",
    "georgia",
    "times-new-roman",
    "verdana",
    "courier-new",
  ];

  return (
    <>
      {showMentions && (
        <div className="absolute bottom-12 left-0 bg-white border rounded shadow-md w-60 max-h-40 overflow-y-auto">
          {activeRoom?.membros
            .filter((m) =>
              m.nome.toLowerCase().includes(mentionQuery.toLowerCase()),
            )
            .map((m) => (
              <div
                key={m.id}
                className="p-2 hover:bg-muted cursor-pointer"
                onClick={() => {
                  setMessageInput((prev) =>
                    prev.replace(/@\w*$/, `@${m.nome} `),
                  );
                  setShowMentions(false);
                }}
              >
                {m.nome}{" "}
                {m.role === "supervisor" && (
                  <Badge className="ml-2">Supervisor</Badge>
                )}
              </div>
            ))}
        </div>
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#01050c]/90 p-0 text-slate-100 backdrop-blur-md md:p-3">
        <div className="relative flex h-full max-h-screen w-full overflow-hidden border border-[#203a54] bg-[#020711] shadow-[0_28px_90px_rgba(0,0,0,.58)] md:h-[calc(100vh-24px)] md:rounded-2xl">
          {!activeRoom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
              title="Fechar chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {/* Sidebar - Lista de Salas */}
          <div className="hidden w-[286px] shrink-0 flex-col border-r border-[#20344a] bg-[#040b16]/95 md:flex">
            {/* Header da Sidebar */}
            <div className="border-b border-[#20344a] p-4">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-white">
                    Chat da equipe
                  </h2>
                  <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.22em] text-slate-400">
                    Aurora Connect
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar salas ou pessoas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-11 border-[#203a54] bg-[#020914] pl-10 text-xs text-white placeholder:text-slate-400 focus-visible:ring-orange-500/25"
                  />
                </div>

                {canManageRoom && (
                  <Button
                    size="sm"
                    onClick={() => setShowCreateRoom(true)}
                    className="h-11 w-11 shrink-0 border border-orange-500/25 bg-orange-500/10 p-0 text-orange-400 hover:bg-orange-500/20"
                    title="Criar sala"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Lista de Salas */}
            <ScrollArea className="flex-1">
              <div className="space-y-1.5 p-3">
                {filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`relative cursor-pointer rounded-xl border p-3 transition hover:border-[#203a54] hover:bg-white/[0.035] ${
                      activeRoom?.id === room.id
                        ? "border-orange-500/25 bg-gradient-to-r from-orange-500/15 to-white/[0.035] shadow-[inset_3px_0_0_#f97316]"
                        : "border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-[#102035] p-2 text-slate-300">
                        {room.tipo === "privado" ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Hash className="h-4 w-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-100">
                            {room.nome}
                          </h3>
                          <Badge
                            variant="outline"
                            className="border-[#29445f] text-[9px] text-slate-300"
                          >
                            {room.tipo}
                          </Badge>
                        </div>

                        {room.descricao && (
                          <p className="mt-1 truncate text-[10px] text-slate-400">
                            {room.descricao}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-2">
                          <Users className="h-3 w-3 text-slate-400" />
                          <span className="text-[10px] text-slate-400">
                            {room?.membros?.length ?? 0} membros
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Usuários Online */}
            <div className="border-t border-[#20344a] bg-[#030914] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Meu status
                </span>
                <span
                  className={`flex items-center gap-1.5 text-[9px] font-medium ${
                    isSocketConnected ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSocketConnected
                        ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                        : "animate-pulse bg-amber-400"
                    }`}
                  />
                  {isSocketConnected ? "Tempo real" : "Reconectando"}
                </span>
              </div>
              <div>
                {currentOnlineUser && (
                  <div
                    key={currentOnlineUser.id}
                    className="flex items-center gap-2"
                  >
                    <div className="relative">
                      <Avatar className="h-9 w-9 border border-[#29445f]">
                        <AvatarImage src={currentOnlineUser.avatar} />
                        <AvatarFallback className="bg-[#102035] text-xs text-slate-200">
                          {currentOnlineUser.nome.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#030914] ${getStatusColor(
                          currentOnlineUser.status,
                        )}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {getUserIcon(currentOnlineUser.role)}
                        <span className="truncate text-xs font-medium text-slate-100">
                          {currentOnlineUser.nome}
                        </span>
                      </div>
                      <span className="text-[9px] text-emerald-400">Online</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Área Principal do Chat */}
          <div className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_55%_18%,rgba(30,92,150,.11),transparent_34%),linear-gradient(180deg,#030a15,#020711)]">
            {activeRoom ? (
              <>
                {/* Header do Chat */}
                <div className="border-b border-[#20344a] bg-[#040c18]/92 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 text-orange-400">
                        <Hash className="h-5 w-5" />
                      </div>

                      <div>
                        <h2 className="font-bold text-white">
                          {activeRoom.nome}
                        </h2>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {activeRoom.descricao ||
                            `Canal operacional • ${activeRoom.carteira || activeRoom.tipo}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-[#29445f] bg-[#07111f] text-[10px] text-slate-200"
                      >
                        {activeRoom?.membros?.length ?? 0} membros
                      </Badge>
                      <span
                        className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] lg:flex ${
                          isSocketConnected
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        <Wifi className="h-3.5 w-3.5" />
                        {isSocketConnected
                          ? "Tempo real conectado"
                          : "Reconectando"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRoomContext((visible) => !visible)}
                        className="text-slate-300 hover:bg-white/5 hover:text-white"
                        title={
                          showRoomContext
                            ? "Fechar contexto da sala"
                            : "Abrir contexto da sala"
                        }
                      >
                        {showRoomContext ? (
                          <PanelRightClose className="h-4 w-4" />
                        ) : (
                          <PanelRightOpen className="h-4 w-4" />
                        )}
                      </Button>

                      {canManageRoom && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-300 hover:bg-white/5 hover:text-white"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border border-[#29445f] bg-[#07111f] text-slate-100"
                          >
                            <DropdownMenuItem
                              onClick={() => setShowRoomSettings(true)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Configurações da Sala
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowUserManagement(true)}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Gerenciar Membros
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowCreateQuiz(true)}
                            >
                              📝 Criar Quiz
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                        title="Fechar chat"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-[#29445f] bg-[#081525]/88 px-4 py-2.5 text-xs text-slate-300">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-slate-300" />
                  ⚠️ Todas as mensagens são registradas e podem ser auditadas.
                  Evite palavrões, xingamentos e linguagem inadequada.
                </div>
                {pinnedMessage && (
                  <div
                    className="mx-4 mt-2 flex items-start gap-2 rounded-xl border border-blue-500/45 bg-blue-600/15 p-3 text-sm text-blue-100"
                  >
                    📌
                    <div className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
                      <button
                        type="button"
                        onClick={scrollToPinnedMessage}
                        className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden text-left transition-opacity hover:opacity-85"
                      >
                        <span className="shrink-0 font-semibold">
                          Mensagem Fixada
                        </span>
                        <span
                          className="min-w-0 flex-1 overflow-hidden break-words text-[13px] leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                          dangerouslySetInnerHTML={{
                            __html:
                              pinnedMessage.conteudo?.trim() ||
                              (pinnedMessage.tipo === "imagem"
                                ? "Imagem enviada"
                                : "Mensagem sem conteúdo"),
                          }}
                        />
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden font-semibold">
                          Mensagem Fixada
                        </span>
                        {["admin", "supervisor"].includes(
                          currentUser?.role || "",
                        ) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-slate-300 hover:bg-rose-500/10 hover:text-rose-300"
                            onClick={unpinMessage}
                          >
                            Remover
                          </Button>
                        )}
                      </div>

                      {/* 👇 Renderiza imagem ou texto conforme o tipo */}
                      {false ? (
                        <div className="hidden mt-2">
                          <img
                            src={normalizeChatAssetUrl(
                              pinnedMessage.imagem_url,
                            )}
                            alt="Imagem fixada"
                            className="max-w-xs rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() =>
                              window.open(
                                normalizeChatAssetUrl(pinnedMessage.imagem_url),
                                "_blank",
                              )
                            }
                          />
                          {pinnedMessage.conteudo &&
                            pinnedMessage.conteudo !== "Imagem enviada" && (
                              <p className="mt-2">{pinnedMessage.conteudo}</p>
                            )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Área de Mensagens */}
                <ScrollArea
                  className="flex-1 px-4 py-2"
                  onScrollCapture={handleMessagesScroll}
                >
                  <div className="mx-auto max-w-5xl space-y-1">
                    {(messages || []).map((message) => (
                      <div
                        key={message.id}
                        ref={(element) => {
                          messageRefs.current[message.id] = element;
                        }}
                        className={`group rounded-xl px-2 py-3 transition-all duration-300 hover:bg-white/[0.018] ${
                          highlightedMessageId === message.id
                            ? "bg-blue-400/10 ring-1 ring-blue-400/40 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
                            : ""
                        }`}
                      >
                        {message.id === firstUnreadMessageId && (
                          <div className="mb-4 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-orange-300">
                            <span className="h-px flex-1 bg-orange-500/25" />
                            {unreadCount}{" "}
                            {unreadCount === 1
                              ? "mensagem nova"
                              : "mensagens novas"}
                            <span className="h-px flex-1 bg-orange-500/25" />
                          </div>
                        )}
                        {message.tipo === "quiz" ? (
                          <div className="flex items-start gap-3">
                            <Avatar className="h-9 w-9 border border-[#29445f]">
                              <AvatarFallback className="bg-[#102035] text-xs text-slate-100">
                                SV
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm text-orange-600">
                                  {message.usuario_nome}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatTime(message.timestamp)}
                                </span>
                              </div>

                              <div className="dark:bg-gray-800 rounded-lg p-3 text-sm">
                                <h4 className="font-bold mb-2">
                                  {message.conteudo}
                                </h4>
                                <div className="space-y-2">
                                  {quizResults[message.quiz_id]
                                    ? quizResults[message.quiz_id].totais.map(
                                        (t: any, idx: number) => {
                                          const totalVotos = quizResults[
                                            message.quiz_id
                                          ].totais.reduce(
                                            (sum: number, item: any) =>
                                              sum + item.votos,
                                            0,
                                          );
                                          const percent =
                                            totalVotos > 0
                                              ? (t.votos / totalVotos) * 100
                                              : 0;

                                          const isCorrect =
                                            t.alternativa ===
                                            quizResults[message.quiz_id]
                                              .correta;
                                          const isWinner =
                                            t.alternativa ===
                                            quizResults[
                                              message.quiz_id
                                            ].totais.reduce((a: any, b: any) =>
                                              a.votos >= b.votos ? a : b,
                                            ).alternativa;

                                          return (
                                            <div key={idx} className="mb-2">
                                              <div className="flex justify-between text-xs mb-1">
                                                <span
                                                  className={`${
                                                    isCorrect
                                                      ? "text-green-400 font-bold"
                                                      : "text-gray-200"
                                                  }`}
                                                >
                                                  {t.alternativa}
                                                </span>
                                                <span>
                                                  {t.votos} voto(s) —{" "}
                                                  {percent.toFixed(0)}%
                                                </span>
                                              </div>
                                              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div
                                                  className={`h-2 ${
                                                    isWinner
                                                      ? "bg-green-500"
                                                      : "bg-blue-500"
                                                  }`}
                                                  style={{
                                                    width: `${percent}%`,
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        },
                                      )
                                    : message.alternativas?.map(
                                        (alt: string, idx: number) => (
                                          <Button
                                            key={idx}
                                            variant="outline"
                                            className="w-full"
                                            disabled={
                                              !!quizAnswers[message.quiz_id]
                                            }
                                            onClick={() => {
                                              socketRef.current.emit(
                                                "answer_quiz",
                                                {
                                                  quiz_id: message.quiz_id,
                                                  sala_id: activeRoom?.id,
                                                  usuario_id: currentUser?.nome,
                                                  alternativa: alt,
                                                },
                                              );
                                              setQuizAnswers((prev) => ({
                                                ...prev,
                                                [message.quiz_id]: alt,
                                              }));
                                            }}
                                          >
                                            {alt}
                                          </Button>
                                        ),
                                      )}
                                  {quizTimer !== null && (
                                    <p className="text-xs text-gray-400">
                                      ⏱ {quizTimer}s restantes
                                    </p>
                                  )}
                                  {!quizResults[message.quiz_id] &&
                                    (currentUser?.role === "admin" ||
                                      currentUser?.role === "supervisor") && (
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="mt-3 w-full"
                                        onClick={() => {
                                          socketRef.current.emit("close_quiz", {
                                            quiz_id: message.quiz_id,
                                            sala_id: activeRoom?.id,
                                          });
                                          toast.info(
                                            "Quiz finalizado manualmente!",
                                          );
                                        }}
                                      >
                                        Finalizar Quiz
                                      </Button>
                                    )}
                                </div>
                                {quizAnswers[message.quiz_id] && (
                                  <p className="mt-2 text-sm text-green-600">
                                    Você respondeu:{" "}
                                    {quizAnswers[message.quiz_id]}
                                  </p>
                                )}
                                {quizResults[message.quiz_id] && (
                                  <div className="mt-3 p-2 dark:bg-gray-900 rounded-md text-sm">
                                    <p className="font-semibold mb-1">
                                      Resultados:
                                    </p>
                                    {quizResults[message.quiz_id].totais.map(
                                      (t: any, idx: number) => {
                                        const isWinner =
                                          t.alternativa ===
                                          quizResults[
                                            message.quiz_id
                                          ].totais.reduce((a: any, b: any) =>
                                            a.votos >= b.votos ? a : b,
                                          ).alternativa;

                                        return (
                                          <p
                                            key={idx}
                                            className={`flex justify-between ${
                                              isWinner
                                                ? "text-green-400 font-bold"
                                                : "text-gray-200"
                                            }`}
                                          >
                                            <span>{t.alternativa}</span>
                                            <span>{t.votos} voto(s)</span>
                                          </p>
                                        );
                                      },
                                    )}

                                    <p className="mt-2 text-xs text-yellow-400">
                                      ✅ Resposta correta:{" "}
                                      {quizResults[message.quiz_id].correta}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : message.tipo === "sistema" ? (
                          <div className="text-center">
                            <Badge variant="secondary" className="text-xs">
                              {message.conteudo}
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <Avatar className="h-9 w-9 border border-[#29445f]">
                              <AvatarImage src={message.usuario_avatar} />
                              <AvatarFallback className="bg-[#102035] text-xs text-slate-100">
                                {message.usuario_nome.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getUserIcon(message.usuario_role)}
                                <span
                                  className={`font-medium text-sm ${
                                    message.usuario_role === "supervisor"
                                      ? "text-orange-400" // Supervisor em azul
                                      : message.usuario_role === "admin"
                                        ? "text-amber-300" // Admin em vermelho
                                        : "text-slate-100" // Operador padrão
                                  }`}
                                >
                                  {message.usuario_nome}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(message.timestamp)}
                                </span>
                                {message.editado && (
                                  <Badge variant="outline" className="text-xs">
                                    editado
                                  </Badge>
                                )}
                              </div>

                              <div className="max-w-3xl rounded-xl border border-[#172a3e] bg-[#101b2c]/90 px-4 py-3 text-sm text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,.12)]">
                                {message.resposta && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      messageRefs.current[
                                        message.resposta?.id || ""
                                      ]?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                      });
                                    }}
                                    className="mb-3 block w-full rounded-lg border-l-2 border-orange-400 bg-white/[0.035] px-3 py-2 text-left"
                                  >
                                    <span className="block text-[10px] font-semibold text-orange-300">
                                      {message.resposta.usuario_nome}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                                      {getPlainTextFromComposer(
                                        message.resposta.conteudo,
                                      )}
                                    </span>
                                  </button>
                                )}
                                {message.tipo === "imagem" ? (
                                  <div>
                                    <img
                                      src={normalizeChatAssetUrl(
                                        message.imagem_url,
                                      )}
                                      alt="Imagem compartilhada"
                                      className="max-w-sm rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() =>
                                        window.open(
                                          normalizeChatAssetUrl(
                                            message.imagem_url,
                                          ),
                                          "_blank",
                                        )
                                      }
                                    />
                                    {message.conteudo !== "Imagem enviada" && (
                                      <p className="mt-2 text-slate-100">
                                        {renderMessage(message.conteudo)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="break-words whitespace-pre-wrap text-slate-100">
                                    {renderMessage(message.conteudo)}
                                  </p>
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                {["👍", "✅", "👀", "🚨"].map((emoji) => {
                                  const reaction = message.reacoes?.find(
                                    (item) => item.emoji === emoji,
                                  );
                                  const reacted = reaction?.usuarios?.includes(
                                    currentUser?.nome || "",
                                  );
                                  return (
                                    <button
                                      type="button"
                                      key={emoji}
                                      onClick={() =>
                                        toggleReaction(message, emoji)
                                      }
                                      className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                                        reacted
                                          ? "border-cyan-400/35 bg-cyan-400/15 text-cyan-200"
                                          : "border-[#203a54] bg-[#07111f] text-slate-400 hover:border-cyan-400/25 hover:text-slate-200"
                                      }`}
                                      title={
                                        reaction?.usuarios?.join(", ") ||
                                        "Adicionar reação"
                                      }
                                    >
                                      {emoji}
                                      {reaction?.quantidade
                                        ? ` ${reaction.quantidade}`
                                        : ""}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReplyingTo(message)}
                                className="text-slate-400 hover:bg-orange-500/10 hover:text-orange-300"
                                title="Responder"
                              >
                                <Reply className="h-4 w-4" />
                              </Button>
                              {canManageRoom && (
                                <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => pinMessage(message)}
                                  className="text-slate-400 hover:bg-blue-500/10 hover:text-blue-300"
                                >
                                  📌
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMessage(message.id)}
                                  className="text-destructive hover:text-destructive  "
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {(!isNearBottom || auroraNotice) && (
                  <div className="pointer-events-none relative z-10 h-0">
                    <div className="absolute bottom-3 right-5 flex flex-col items-end gap-2">
                      {auroraNotice && (
                        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-[#071421]/95 px-3 py-2 text-[10px] text-slate-200 shadow-xl">
                          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                          <span>
                            <strong className="text-orange-300">Aurora:</strong>{" "}
                            {auroraNotice}
                          </span>
                        </div>
                      )}
                      {!isNearBottom && (
                        <button
                          type="button"
                          onClick={() => scrollToBottom()}
                          className="pointer-events-auto flex items-center gap-2 rounded-full border border-orange-500/25 bg-[#07111f] px-3 py-2 text-[10px] font-medium text-slate-200 shadow-xl hover:border-orange-400/40 hover:text-white"
                        >
                          <ArrowDown className="h-3.5 w-3.5 text-orange-300" />
                          {unreadCount > 0
                            ? `${unreadCount} nova${unreadCount > 1 ? "s" : ""}`
                            : "Ir para o final"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Input de Mensagem */}
                <div className="border-t border-[#20344a] bg-[#040c18]/95 p-3">
                  <div className="mx-auto flex max-w-5xl items-end gap-3">
                    <div className="flex-1">
                      <div className="relative rounded-xl border border-[#29445f] bg-[#020914] p-2 pb-10 focus-within:border-orange-500/35 focus-within:ring-2 focus-within:ring-orange-500/10">
                        <style>{chatComposerQuillStyles}</style>
                        {replyingTo && (
                          <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border-l-2 border-orange-400 bg-white/[0.035] px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-orange-300">
                                Respondendo {replyingTo.usuario_nome}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-slate-400">
                                {getPlainTextFromComposer(replyingTo.conteudo)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setReplyingTo(null)}
                              className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                              title="Cancelar resposta"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {/* {currentUser?.role === "admin" ||
                        currentUser?.role === "supervisor" ? (
                          <ReactQuill
                            value={messageInput}
                            onChange={handleInputChange}
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                              }
                            }}
                            modules={quillModules}
                            formats={quillFormats}
                            placeholder={`Digite uma mensagem para #${activeRoom.nome}`}
                            className="chat-composer-quill min-h-[40px] max-h-32 resize-none"
                          />
                        ) : ( */}
                          <Textarea
                            placeholder={`Digite uma mensagem para #${activeRoom.nome}`}
                            value={messageInput}
                            onChange={handleInputChange}
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                              }
                            }}
                            className="min-h-[42px] max-h-28 resize-none border-0 bg-transparent px-2 py-1 text-sm text-white shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                          />
                        {/* )} */}
                        {typingUsers.length > 0 && (
                          <p className="absolute bottom-2 left-20 max-w-[55%] truncate text-[9px] text-cyan-300">
                            {typingUsers.length === 1
                              ? `${typingUsers[0]} está digitando...`
                              : `${typingUsers.slice(0, 2).join(" e ")} estão digitando...`}
                          </p>
                        )}
                        {/* Botão Emoji */}
                        <button
                          type="button"
                          onClick={() => {
                            setMessageInput((previous) => `${previous}@`);
                            setMentionQuery("");
                            setShowMentions(true);
                          }}
                          className="absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-white"
                          title="Mencionar pessoa"
                        >
                          <AtSign className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="absolute bottom-2 left-10 grid h-7 w-7 place-items-center rounded-md text-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
                          title="Emojis"
                        >
                          😊
                        </button>
                        {/* Picker */}
                        {showEmojiPicker && (
                          <div className="absolute bottom-12 right-0 z-50">
                            <Picker
                              data={data}
                              onEmojiSelect={(emoji: any) => {
                                if (isBlockedEmoji(emoji.native)) {
                                  setMessageInput((prev) =>
                                    censorBlockedEmojis(prev + emoji.native),
                                  );
                                } else {
                                  setMessageInput(
                                    (prev) => prev + emoji.native,
                                  );
                                }
                                setShowEmojiPicker(false);
                              }}
                              theme="dark"
                              except={["flags", "animals-nature"]}
                            />
                          </div>
                        )}
                        {/* Dropdown de menções */}
                        {showMentions && (
                          <div className="absolute bottom-12 left-0 bg-background border border-border rounded-md shadow-md w-60 max-h-40 overflow-y-auto z-50">
                            {activeRoom?.membros
                              .filter((m) =>
                                m.nome
                                  .toLowerCase()
                                  .includes(mentionQuery.toLowerCase()),
                              )
                              .map((m) => (
                                <div
                                  key={m.id}
                                  className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                                  onClick={() => {
                                    setMessageInput((prev) =>
                                      prev.replace(/@\w*$/, `@${m.nome} `),
                                    );
                                    setShowMentions(false);
                                  }}
                                >
                                  <span>{m.nome}</span>
                                  {m.role === "supervisor" && (
                                    <Badge variant="secondary">
                                      Supervisor
                                    </Badge>
                                  )}
                                  {m.role === "admin" && (
                                    <Badge variant="destructive">Admin</Badge>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(currentUser?.role === "supervisor" ||
                        currentUser?.role === "admin") && (
                        <>
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              const formData = new FormData();
                              formData.append("file", file);

                              try {
                                const response = await requestChat<{
                                  url: string;
                                  filename: string;
                                }>("post", "/upload", {
                                  data: formData,
                                  headers: {
                                    "Content-Type": "multipart/form-data",
                                  },
                                });

                                const imageUrl = normalizeChatAssetUrl(
                                  response.data.url,
                                );
                                const imageFilename = response.data.filename;

                                if (activeRoom && currentUser) {
                                  const payload = {
                                    sala_id: activeRoom.id,
                                    usuario_nome: currentUser.nome,
                                    usuario_role: currentUser.role,
                                    carteira: currentUser.carteira,
                                    conteudo: "Imagem enviada",
                                    tipo: "imagem",
                                    imagem_nome: imageFilename,
                                    imagem_url: imageUrl,
                                  };

                                  if (socketRef.current?.connected) {
                                    socketRef.current.emit(
                                      "send_message",
                                      payload,
                                    );
                                  } else {
                                    const messageResponse =
                                      await requestChat<ChatMessage>(
                                        "post",
                                        `/rooms/${activeRoom.id}/messages`,
                                        { data: payload },
                                      );

                                    setMessages((prev) => [
                                      ...prev,
                                      {
                                        ...messageResponse.data,
                                        imagem_url: normalizeChatAssetUrl(
                                          messageResponse.data.imagem_url,
                                        ),
                                      },
                                    ]);
                                  }
                                }

                                toast.success("Imagem enviada com sucesso!");
                              } catch (err) {
                                toast.error("Erro ao enviar imagem");
                              } finally {
                                e.target.value = ""; // limpa o input
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            title="Enviar imagem"
                            className="border border-[#29445f] bg-[#07111f] text-slate-300 hover:bg-white/5 hover:text-white"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <Button
                        onClick={sendMessage}
                        disabled={!messageInput.trim()}
                        className="h-11 shrink-0 bg-orange-500 px-4 text-white shadow-[0_8px_24px_rgba(249,115,22,.22)] hover:bg-orange-600 disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        <Send className="h-4 w-4" />
                        <span className="ml-2 hidden text-xs font-semibold sm:inline">
                          Enviar
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Selecione uma sala
                  </h3>
                  <p className="text-muted-foreground">
                    Escolha uma sala para começar a conversar
                  </p>
                </div>
              </div>
            )}
          </div>

          {activeRoom && showRoomContext && (
            <aside className="hidden w-[320px] shrink-0 flex-col border-l border-[#20344a] bg-[#040b16]/96 xl:flex">
              <div className="border-b border-[#20344a] px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Contexto da sala
                    </h3>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-slate-400">
                      Informações do canal
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRoomContext(false)}
                    className="text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-1 border-b border-[#20344a]">
                  {(
                    [
                      ["membros", "Membros"],
                      ["fixadas", "Fixadas"],
                      ["arquivos", "Arquivos"],
                      ["quizzes", "Quizzes"],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => setRoomContextTab(tab)}
                      className={`border-b-2 px-1 pb-2 text-[10px] font-medium transition ${
                        roomContextTab === tab
                          ? "border-orange-500 text-orange-400"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-5 p-4">
                  {roomContextTab === "membros" && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Membros ({activeRoom.membros?.length ?? 0})
                        </span>
                        {canManageRoom && (
                          <button
                            type="button"
                            onClick={() => setShowUserManagement(true)}
                            className="text-[10px] font-medium text-blue-400 hover:text-blue-300"
                          >
                            Gerenciar
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(activeRoom.membros || []).map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-[#203a54] hover:bg-white/[0.025]"
                          >
                            <div className="relative">
                              <Avatar className="h-8 w-8 border border-[#29445f]">
                                <AvatarImage src={member.avatar} />
                                <AvatarFallback className="bg-[#102035] text-[10px] text-slate-200">
                                  {member.nome.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#040b16] ${getStatusColor(
                                  member.status,
                                )}`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-slate-100">
                                {member.nome}
                              </p>
                              <p className="mt-0.5 text-[9px] capitalize text-slate-400">
                                {member.role}
                              </p>
                            </div>
                            {member.role !== "operador" &&
                              getUserIcon(member.role)}
                          </div>
                        ))}
                      </div>
                      {canManageRoom && (
                        <Button
                          variant="outline"
                          onClick={() => setShowUserManagement(true)}
                          className="w-full border-[#29445f] bg-[#07111f] text-xs text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Convidar membro
                        </Button>
                      )}
                      {!canManageRoom && (
                        <div className="rounded-xl border border-[#203a54] bg-[#07111f] p-3 text-[10px] leading-relaxed text-slate-400">
                          A lista é somente informativa. A gestão de membros é
                          restrita à supervisão.
                        </div>
                      )}
                    </>
                  )}

                  {roomContextTab === "fixadas" && (
                    <>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Mensagens fixadas
                      </span>
                      {pinnedMessage ? (
                        <button
                          type="button"
                          onClick={scrollToPinnedMessage}
                          className="flex w-full gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-left hover:border-blue-400/40"
                        >
                          <Pin className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                          <div className="min-w-0">
                            <p
                              className="line-clamp-3 text-xs leading-relaxed text-slate-100"
                              dangerouslySetInnerHTML={{
                                __html: getPinnedMessagePreview(pinnedMessage),
                              }}
                            />
                            <span className="mt-2 block text-[9px] text-slate-400">
                              Clique para localizar na conversa
                            </span>
                          </div>
                        </button>
                      ) : (
                        <ContextEmptyState
                          icon={<Pin className="h-5 w-5" />}
                          text="Nenhuma mensagem fixada nesta sala."
                        />
                      )}
                      {pinnedMessage && canManageRoom && (
                        <Button
                          variant="ghost"
                          onClick={unpinMessage}
                          className="w-full text-xs text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          Remover mensagem fixada
                        </Button>
                      )}
                    </>
                  )}

                  {roomContextTab === "arquivos" && (
                    <>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Imagens recentes
                      </span>
                      {recentImageMessages.length > 0 ? (
                        <div className="space-y-2">
                          {recentImageMessages.map((message) => (
                            <button
                              type="button"
                              key={message.id}
                              onClick={() =>
                                window.open(
                                  normalizeChatAssetUrl(message.imagem_url),
                                  "_blank",
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-xl border border-[#203a54] bg-[#07111f] p-3 text-left hover:border-blue-400/35"
                            >
                              <FileText className="h-5 w-5 text-blue-300" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs text-slate-100">
                                  Imagem compartilhada
                                </p>
                                <p className="mt-1 truncate text-[9px] text-slate-400">
                                  {message.usuario_nome} •{" "}
                                  {formatTime(message.timestamp)}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <ContextEmptyState
                          icon={<FileText className="h-5 w-5" />}
                          text="Nenhum arquivo compartilhado nesta sala."
                        />
                      )}
                    </>
                  )}

                  {roomContextTab === "quizzes" && (
                    <>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Quizzes da sala
                      </span>
                      {roomQuizMessages.length > 0 ? (
                        <div className="space-y-2">
                          {roomQuizMessages.map((quiz) => (
                            <div
                              key={quiz.id}
                              className="rounded-xl border border-[#203a54] bg-[#07111f] p-3"
                            >
                              <div className="flex gap-3">
                                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-300">
                                  <GraduationCap className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="line-clamp-2 text-xs font-medium text-slate-100">
                                    {quiz.conteudo}
                                  </p>
                                  <p className="mt-1 text-[9px] text-slate-400">
                                    {quiz.alternativas?.length ?? 0} alternativas
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ContextEmptyState
                          icon={<GraduationCap className="h-5 w-5" />}
                          text="Nenhum quiz publicado nesta sala."
                        />
                      )}
                      {canManageRoom && (
                        <Button
                          onClick={() => setShowCreateQuiz(true)}
                          className="w-full bg-orange-500 text-xs text-white hover:bg-orange-600"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Criar quiz
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </aside>
          )}
        </div>

        {/* Modal de Criar Sala */}
        <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
          <DialogContent className="bg-background z-[9999] border border-border">
            <DialogHeader>
              <DialogTitle>Criar Nova Sala</DialogTitle>
              <DialogDescription>
                Crie uma nova sala de chat para sua equipe
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome da Sala</label>
                <Input
                  placeholder="Ex: Reunião Diária"
                  value={newRoom.nome}
                  onChange={(e) =>
                    setNewRoom({ ...newRoom, nome: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Descrição (opcional)
                </label>

                {/* {currentUser?.role === "admin" ||
                currentUser?.role === "supervisor" ? (
                  <ReactQuill
                    theme="snow"
                    value={newRoom.descricao}
                    onChange={(value) => {
                      setNewRoom({
                        ...newRoom,
                        descricao: censorBlockedEmojis(value),
                      });
                    }}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Descreva o propósito desta sala..."
                    className="chat-composer-quill room-description-quill min-h-[40px] resize-none"
                  />
                ) : ( */}
                  <Textarea
                    placeholder="Descreva o propósito desta sala..."
                    value={newRoom.descricao}
                    onChange={(e) =>
                      setNewRoom({ ...newRoom, descricao: e.target.value })
                    }
                  />
                {/* )} */}
              </div>

              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select
                  value={newRoom.tipo}
                  onValueChange={(value: any) =>
                    setNewRoom({ ...newRoom, tipo: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className=" bg-background border border-border">
                    <SelectItem value="carteira">Carteira</SelectItem>
                    <SelectItem value="privado">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newRoom.tipo === "carteira" && (
                <div>
                  <label className="text-sm font-medium">Carteira</label>
                  <Input
                    value={newRoom.carteira}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateRoom(false)}
              >
                Cancelar
              </Button>
              <Button onClick={createRoom}>Criar Sala</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Gerenciar Membros */}
        <Dialog open={showUserManagement} onOpenChange={setShowUserManagement}>
          <DialogContent className="bg-background border border-border max-w-3xl">
            <DialogHeader>
              <DialogTitle>Gerenciar Membros - {activeRoom?.nome}</DialogTitle>
              <DialogDescription>
                Adicione ou remova membros desta sala
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna - Membros Atuais */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Membros Atuais
                </h4>

                {/* Campo de busca para membros */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar membro..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-64 pr-2">
                  <div className="space-y-2">
                    {(activeRoom?.membros || [])
                      .filter((m) =>
                        m.nome
                          .toLowerCase()
                          .includes(memberSearch.toLowerCase()),
                      )
                      .map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback className="text-xs">
                                {member.nome.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {member.nome}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.role}
                              </p>
                            </div>
                          </div>

                          {currentUser?.role === "admin" &&
                            member.role !== "admin" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeUserFromRoom(member.id)}
                                className="text-destructive hover:text-red-600"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Coluna - Usuários Disponíveis */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Usuários Disponíveis
                </h4>

                {/* Campo de busca para usuários */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-64 pr-2">
                  <div className="space-y-2">
                    {availableUsers
                      .filter(
                        (user) =>
                          !(activeRoom?.membros ?? []).some(
                            (member) => member.id === user.id,
                          ),
                      )
                      .filter((u) =>
                        u.nome.toLowerCase().includes(userSearch.toLowerCase()),
                      )
                      .map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="text-xs">
                                {user.nome.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{user.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {user.role}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addUserToRoom(user.id)}
                            className="text-primary hover:text-blue-600"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => setShowUserManagement(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Modal de Configurações da Sala */}
        <Dialog open={showRoomSettings} onOpenChange={setShowRoomSettings}>
          <DialogContent className="bg-background border border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Configurações da Sala</DialogTitle>
              <DialogDescription>
                Atualize as informações ou remova esta sala permanentemente.
              </DialogDescription>
            </DialogHeader>

            {activeRoom && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome da Sala</label>
                  <Input
                    value={activeRoom.nome}
                    onChange={(e) =>
                      setActiveRoom({ ...activeRoom, nome: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    value={activeRoom.descricao || ""}
                    onChange={(e) =>
                      setActiveRoom({
                        ...activeRoom,
                        descricao: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Tem certeza que deseja excluir esta sala? Esta ação não pode ser desfeita.",
                        )
                      )
                        return;

                      try {
                        await requestChat("delete", `/rooms/${activeRoom.id}`);
                        toast.success("Sala excluída com sucesso");
                        setShowRoomSettings(false);
                        loadRooms(); // Atualiza lista de salas
                        setActiveRoom(null);
                      } catch {
                        toast.error("Erro ao excluir sala");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Sala
                  </Button>

                  <Button
                    onClick={async () => {
                      try {
                        await requestChat("put", `/rooms/${activeRoom.id}`, {
                          data: {
                            nome: activeRoom.nome,
                            descricao: activeRoom.descricao,
                          },
                        });
                        toast.success("Sala atualizada com sucesso");
                        setShowRoomSettings(false);
                        loadRooms();
                      } catch {
                        toast.error("Erro ao atualizar sala");
                      }
                    }}
                  >
                    <Edit3 className="h-4 w-4 mr-2" /> Salvar Alterações
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRoomSettings(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateQuiz} onOpenChange={setShowCreateQuiz}>
          <DialogContent className="bg-background border border-border max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Quiz</DialogTitle>
              <DialogDescription>
                Defina a pergunta e as alternativas do quiz.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Pergunta</label>
                <Input
                  value={newQuiz.pergunta}
                  onChange={(e) =>
                    setNewQuiz((prev) => ({
                      ...prev,
                      pergunta: e.target.value,
                    }))
                  }
                  placeholder="Digite a pergunta"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Alternativas</label>
                {newQuiz.alternativas.map((alt, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <Input
                      value={alt}
                      onChange={(e) => {
                        const alts = [...newQuiz.alternativas];
                        alts[idx] = e.target.value;
                        setNewQuiz((prev) => ({ ...prev, alternativas: alts }));
                      }}
                      placeholder={`Alternativa ${idx + 1}`}
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        setNewQuiz((prev) => ({
                          ...prev,
                          alternativas: prev.alternativas.filter(
                            (_, i) => i !== idx,
                          ),
                        }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNewQuiz((prev) => ({
                      ...prev,
                      alternativas: [...prev.alternativas, ""],
                    }))
                  }
                >
                  + Adicionar alternativa
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium">Resposta Correta</label>
                <Select
                  value={newQuiz.correta}
                  onValueChange={(value) =>
                    setNewQuiz((prev) => ({ ...prev, correta: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a correta" />
                  </SelectTrigger>
                  <SelectContent>
                    {newQuiz.alternativas.map((alt, idx) => (
                      <SelectItem key={idx} value={alt || `alt-${idx}`}>
                        {alt || `Alternativa ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Tempo (segundos)</label>
                <Input
                  type="number"
                  value={newQuiz.tempo_limite}
                  onChange={(e) =>
                    setNewQuiz((prev) => ({
                      ...prev,
                      tempo_limite: parseInt(e.target.value) || 600,
                    }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateQuiz(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!activeRoom)
                    return toast.error("Selecione uma sala primeiro");
                  if (!newQuiz.pergunta || newQuiz.alternativas.length < 2)
                    return toast.error(
                      "Preencha pergunta e pelo menos 2 alternativas",
                    );
                  if (!newQuiz.correta)
                    return toast.error("Selecione a alternativa correta");

                  socketRef.current.emit("create_quiz", {
                    sala_id: activeRoom.id,
                    pergunta: newQuiz.pergunta,
                    alternativas: newQuiz.alternativas,
                    correta: newQuiz.correta,
                    tempo_limite: newQuiz.tempo_limite,
                    criado_por: currentUser?.nome, // 👈 GUID
                  });

                  toast.success("Quiz criado e enviado!");
                  setShowCreateQuiz(false);
                  setNewQuiz({
                    pergunta: "",
                    alternativas: [""],
                    correta: "",
                    tempo_limite: 600,
                  });
                }}
              >
                Criar Quiz
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default ChatFullTime;
