import React, { useState, useEffect } from "react";
import { X, Save, Trash2, Clock, User, IdCard, Building2, CalendarClock } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "sonner";

interface Agendamento {
  id: number;
  nome: string;
  cpf: string;
  ec: string;
  horario_retorno: string;
  data_criacao: string;
}

interface AgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AgendamentoModal: React.FC<AgendamentoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    ec: "",
    horario_retorno: "",
  });
  const [loading, setLoading] = useState(false);
  const [alerta, setAlerta] = useState<Agendamento | null>(null);

  const usuario = localStorage.getItem("nomeCompleto");

  useEffect(() => {
    if (isOpen) carregarAgendamentos();
  }, [isOpen]);

  const carregarAgendamentos = async () => {
    try {
      const response = await axiosInstance.get(
        "/api/agendamentos",
        {
          params: { usuario },
        }
      );
      setAgendamentos(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      toast.error("Erro ao carregar agendamentos");
    }
  };

  const salvarAgendamento = async () => {
    if (
      !formData.nome ||
      !formData.cpf ||
      !formData.ec ||
      !formData.horario_retorno
    ) {
      toast.error("Preencha todos os campos");
      return;
    }
    try {
      setLoading(true);
      await axiosInstance.post("/api/agendamentos", {
        ...formData,
        usuario,
      });
      toast.success("Agendamento criado!");
      setFormData({ nome: "", cpf: "", ec: "", horario_retorno: "" });
      carregarAgendamentos();
    } catch (error) {
      toast.error("Erro ao salvar agendamento");
    } finally {
      setLoading(false);
    }
  };

  const excluirAgendamento = async (id: number) => {
    try {
      await axiosInstance.delete("/api/agendamentos", {
        params: { id },
      });
      toast.success("Agendamento removido!");
      carregarAgendamentos();
    } catch {
      toast.error("Erro ao excluir agendamento");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const agora = new Date();
      agendamentos.forEach((a) => {
        const retorno = new Date(a.horario_retorno);
        if (
          retorno <= agora &&
          retorno.getTime() + 60000 > agora.getTime() // tolerância 1 min
        ) {
          setAlerta(a); // dispara o popup
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [agendamentos]);

  if (!isOpen) return null;

  return (
    <div className="appointments-hud-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="appointments-hud-panel relative flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden">
        {/* Header */}
        <div className="appointments-hud-header flex items-center justify-between px-6 py-5">
          <h2 className="flex items-center gap-3 text-xl font-semibold">
            <CalendarClock className="h-6 w-6" />
            <span>Agendamentos de Retorno</span>
          </h2>
          <button
            onClick={onClose}
            className="appointments-hud-close rounded-full p-2 transition"
            aria-label="Fechar agendamentos"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="appointments-hud-form p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="appointments-hud-field relative">
              <User className="absolute left-3 top-3 h-4 w-4" />
              <input
                type="text"
                placeholder="Nome"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                className="w-full rounded-lg py-2 pl-10 pr-3"
              />
            </div>
            <div className="appointments-hud-field relative">
              <IdCard className="absolute left-3 top-3 h-4 w-4" />
              <input
                type="text"
                placeholder="CPF"
                value={formData.cpf}
                onChange={(e) =>
                  setFormData({ ...formData, cpf: e.target.value })
                }
                className="w-full rounded-lg py-2 pl-10 pr-3"
              />
            </div>
            <div className="appointments-hud-field relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4" />
              <input
                type="text"
                placeholder="EC"
                value={formData.ec}
                onChange={(e) =>
                  setFormData({ ...formData, ec: e.target.value })
                }
                className="w-full rounded-lg py-2 pl-10 pr-3"
              />
            </div>
            <div className="appointments-hud-field relative">
              <Clock className="absolute left-3 top-3 h-4 w-4" />
              <input
                type="datetime-local"
                aria-label="Data e horário do retorno"
                value={formData.horario_retorno}
                onChange={(e) =>
                  setFormData({ ...formData, horario_retorno: e.target.value })
                }
                className="w-full rounded-lg py-2 pl-10 pr-3"
              />
            </div>
            <button
              onClick={salvarAgendamento}
              disabled={loading}
              className="appointments-hud-save flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white transition disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="appointments-hud-body flex-1 overflow-y-auto p-5 md:p-6">
          {agendamentos.length === 0 ? (
            <div className="appointments-hud-empty py-16 text-center">
              <Clock className="mx-auto mb-4 h-12 w-12" />
              <p>
                Nenhum agendamento cadastrado.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {agendamentos.map((a) => (
                <li
                  key={a.id}
                  className="appointments-hud-item flex items-center justify-between gap-4 rounded-2xl p-4 transition"
                >
                  <div>
                    <p className="font-semibold text-blue-50">
                      {a.nome}{" "}
                      <span className="text-sm font-normal text-blue-100/40">({a.cpf})</span>
                    </p>
                    <p className="mt-1 text-sm text-blue-100/55">
                      EC: {a.ec}
                    </p>
                    <p className="mt-1 text-sm font-medium text-orange-300">
                      Retorno em:{" "}
                      {new Date(a.horario_retorno).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={() => excluirAgendamento(a.id)}
                    className="appointments-hud-delete rounded-lg p-2 transition"
                    aria-label={`Excluir agendamento de ${a.nome}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {alerta && (
        <div className="appointments-alert-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="appointments-alert-panel w-full max-w-lg rounded-2xl p-8 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 animate-bounce" />
            <h2 className="mb-2 text-2xl font-bold">
              ⚠️ Retorno Pendente!
            </h2>
            <p className="text-lg text-blue-100/65">
              Você precisa retornar agora para:
            </p>
            <p className="mt-3 text-xl font-semibold text-blue-50">
              {alerta.nome} ({alerta.cpf})
            </p>
            <p className="text-blue-100/45">EC: {alerta.ec}</p>
            <p className="mt-2 font-medium text-orange-300">
              Horário agendado:{" "}
              {new Date(alerta.horario_retorno).toLocaleString("pt-BR")}
            </p>

            <button
              onClick={() => setAlerta(null)}
              className="appointments-alert-action mt-6 rounded-lg px-6 py-3 text-white transition"
            >
              Fechar Alerta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendamentoModal;
