import React, { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "@/utils/axiosInstance";

interface OperatorMetrics {
  day: number;
  week: number;
  month: number;
}

interface CPCData {
  day: number;
}

interface CEData {
  day: number;
}

interface AcionamentoData {
  day: number;
}

interface ProjectionData {
  estimatedEndOfMonth: number;
  dailyAverage: number;
  businessDaysRemaining: number;
}

interface OperatorData {
  name: string;
  role: string;
  avatar: string;
  metrics: {
    agreements: OperatorMetrics;
    values: OperatorMetrics;
    payments: OperatorMetrics;
    conversionRate: OperatorMetrics;
    calls: OperatorMetrics;
  };
  ranking: {
    position: number;
    totalOperators: number;
  };
  topPerformance: {
    day: string;
    timeOfDay: string;
  };
  projection: ProjectionData;
  cpc: CPCData;
  ce: CEData;
  acionamento: AcionamentoData;
}

interface ResultadoOperadorType {
  operatorData: OperatorData | null;
  isLoading: boolean;
  operatorError: string | null;
  fetchOperatorData: () => void;
}

const ResultadoOperador = createContext<ResultadoOperadorType | undefined>(
  undefined
);

export const ResultadoOperadorProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [operatorData, setOperatorData] = useState<OperatorData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [operatorError, setOperatorError] = useState<string | null>(null);

  const fetchOperatorData = () => {
    const username = localStorage.getItem("nomeCompleto");
    const id_cedente = localStorage.getItem("id_cedente") || "Indefinido";
    const carteira = localStorage.getItem("userCarteira") || "Não definida";
    const token = localStorage.getItem("userToken");
    const id_cedente_num = parseInt(localStorage.getItem("id_cedente") || "0");
    const campoAcordo =
      id_cedente_num === 3 ||
      id_cedente_num === 60 ||
      id_cedente_num === 71 ||
      id_cedente_num === 77
        ? "valor_risco"
        : "valor_entrada";

    const campoPagamento =
      id_cedente_num === 3 ||
      id_cedente_num === 60 ||
      id_cedente_num === 71 ||
      id_cedente_num == 77
        ? "valor_risco_pago"
        : "valor_pago";

    if (!token?.trim()) {
      setOperatorData(null);
      setOperatorError(
        "Não foi possível identificar o operador. Atualize a página ou entre novamente.",
      );
      setIsLoading(false);
      return;
    }

    setOperatorError(null);
    setIsLoading(true);

    const dataHoje = new Date().toISOString().slice(0, 10);

    // Funções auxiliares
    const somarCampo = (lista: any[], campo: string) =>
      lista.reduce((acc, item) => acc + parseFloat(item[campo] || "0"), 0);

    const contarPagamentos = (lista: any[]) =>
      lista.filter((item) => parseFloat(item[campoPagamento] || "0") > 0)
        .length;

    const capitalize = (str: string) =>
      str.charAt(0).toUpperCase() + str.slice(1);

    const isWithinCurrentMonth = (dateString: string): boolean => {
      if (!dateString) return false;
      const [ano, mes, dia] = dateString.split("-").map(Number);
      const data = new Date(ano, mes - 1, dia);
      const hoje = new Date();

      return (
        data.getFullYear() === hoje.getFullYear() &&
        data.getMonth() === hoje.getMonth()
      );
    };

    const isThisWeek = (dateString: string): boolean => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const [ano, mes, dia] = dateString.split("T")[0].split("-").map(Number);
      const data = new Date(ano, mes - 1, dia);
      data.setHours(0, 0, 0, 0);
      const diaSemanaHoje = hoje.getDay();
      const offset = diaSemanaHoje === 0 ? -6 : 1 - diaSemanaHoje;
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() + offset);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6);
      fimSemana.setHours(23, 59, 59, 999);
      return data >= inicioSemana && data <= fimSemana;
    };

    // Requisições paralelas
    Promise.allSettled([
      axiosInstance.post(`/api/operadores/resultado`, {
        id_cedente,
        filtro: "dia",
        data_inicio: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        )
          .toISOString()
          .slice(0, 10),
        data_fim: dataHoje,
      }),
      axiosInstance.post("/api/operadores/resultado-cpc", {}),
    ])
      .then(([resultadoRequest, cpcRequest]) => {
        if (resultadoRequest.status === "rejected") {
          throw resultadoRequest.reason;
        }

        const res = resultadoRequest.value;
        const resCpc =
          cpcRequest.status === "fulfilled" ? cpcRequest.value : null;
        const registros = res.data.dados || [];

        const cpcDoDia = resCpc?.data?.dados_cpc?.[0]?.total_cpc || 0;
        const ceDoDia = resCpc?.data?.dados_cpc?.[0]?.ce_do_dia || 0;
        const acionamento = resCpc?.data?.dados_cpc?.[0]?.acionamento || 0;

        const dataHoje = new Date().toISOString().slice(0, 10);

        const normalizar = (v: string) => {
          if (!v) return null;

          // extrair dia, mes, ano manualmente
          const d = new Date(v);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(d.getUTCDate()).padStart(2, "0");

          return `${yyyy}-${mm}-${dd}`;
        };

        const normalizeDate = (dateStr: string) => {
          if (!dateStr) return null;
          const date = new Date(dateStr);
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };

        const registrosHoje = registros.filter(
          (item) => normalizar(item.data_registro) === dataHoje
        );

        const registrosSemana = registros.filter((item) =>
          isThisWeek(normalizar(item.data_registro)!)
        );

        const pagamentosRecebidosHoje = registros.filter(
          (item) => normalizeDate(item.data_pagamento) === dataHoje
        );

        const pagamentosRecebidosSemana = registros.filter((item) => {
          const normalizada = normalizeDate(item.data_pagamento);
          return normalizada && isThisWeek(normalizada);
        });

        const pagamentosRecebidosNoMesAtual = registros.filter((item) => {
          const normalizada = normalizeDate(item.data_pagamento);
          return normalizada && isWithinCurrentMonth(normalizada);
        });

        const registrosMes = registros;
        const totalFechadosMes = somarCampo(registros, campoAcordo);

        const totalPago = somarCampo(
          pagamentosRecebidosNoMesAtual,
          campoPagamento
        );

        const diaSemanaCount: Record<string, number> = {};
        const horarioCount: Record<string, number> = {};
        const diasSemana = [
          "domingo",
          "segunda-feira",
          "terça-feira",
          "quarta-feira",
          "quinta-feira",
          "sexta-feira",
          "sábado",
        ];

        registros.forEach((item) => {
          const dataObj = new Date(item.data_registro);

          // Pegue o horário UTC para garantir a data correta
          const utcDate = new Date(
            dataObj.getTime() + dataObj.getTimezoneOffset() * 60000
          );
          const diaSemana = diasSemana[utcDate.getDay()];

          const horario = item.horario_atendimento;

          if (diaSemana)
            diaSemanaCount[diaSemana] = (diaSemanaCount[diaSemana] || 0) + 1;
          if (horario) horarioCount[horario] = (horarioCount[horario] || 0) + 1;
        });

        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth();

        const diasUteisAteHoje = Array.from(
          { length: hoje.getDate() },
          (_, i) => new Date(ano, mes, i + 1)
        ).filter((date) => date.getDay() !== 0).length;

        const mediaDiaria =
          diasUteisAteHoje > 0 ? totalPago / diasUteisAteHoje : 0;

        const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
        const diasUteisRestantes = Array.from(
          { length: ultimoDiaMes - hoje.getDate() },
          (_, i) => new Date(ano, mes, hoje.getDate() + i + 1)
        ).filter((date) => date.getDay() !== 0).length;

        const valorProjetado = totalPago + mediaDiaria * diasUteisRestantes;

        const topDay =
          Object.entries(diaSemanaCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "";
        const topTime =
          Object.entries(horarioCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "";

        const formatted: OperatorData = {
          name: username || "Operador",
          role: carteira,
          avatar: `https://ui-avatars.com/?name=${username || "Operador"}&background=6366f1&color=fff`,
          metrics: {
            agreements: {
              day: registrosHoje.length,
              week: registrosSemana.length,
              month: registrosMes.length,
            },
            values: {
              day: somarCampo(registrosHoje, campoAcordo),
              week: somarCampo(registrosSemana, campoAcordo),
              month: totalFechadosMes,
            },
            payments: {
              day: somarCampo(pagamentosRecebidosHoje, campoPagamento),
              week: somarCampo(pagamentosRecebidosSemana, campoPagamento),
              month: somarCampo(pagamentosRecebidosNoMesAtual, campoPagamento),
            },
            conversionRate: {
              day: contarPagamentos(registrosHoje),
              week: contarPagamentos(registrosSemana),
              month: contarPagamentos(registrosMes),
            },
            calls: {
              day: registrosHoje.length,
              week: registrosSemana.length,
              month: registrosMes.length,
            },
          },
          projection: {
            estimatedEndOfMonth: valorProjetado,
            dailyAverage: mediaDiaria,
            businessDaysRemaining: diasUteisRestantes,
          },
          ranking: {
            position: 0,
            totalOperators: 0,
          },
          topPerformance: {
            day: capitalize(topDay),
            timeOfDay: topTime,
          },
          cpc: cpcDoDia,
          ce: ceDoDia,
          acionamento: acionamento,
        };
        setOperatorData(formatted);
        setOperatorError(null);
      })
      .catch((err) => {
        console.error("Erro ao buscar dados do operador ou CPC:", err);
        const apiMessage =
          err?.response?.data?.detalhes ||
          err?.response?.data?.erro ||
          err?.message;
        setOperatorError(
          apiMessage ||
            "Não foi possível consultar o desempenho agora. Tente novamente.",
        );
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchOperatorData();

    const interval = setInterval(() => {
      fetchOperatorData();
    }, 30 * 60 * 1000); // 30 minutos

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <ResultadoOperador.Provider
      value={{ operatorData, isLoading, operatorError, fetchOperatorData }}
    >
      {children}
    </ResultadoOperador.Provider>
  );
};

export const useResultadoOperador = (): ResultadoOperadorType => {
  const context = useContext(ResultadoOperador);
  if (!context) {
    throw new Error(
      "useResultadoOperador deve ser usado dentro de ResultadoOperadorProvider"
    );
  }
  return context;
};
