import { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { div } from "three/src/nodes/TSL.js";
import Markdown from "react-markdown";
import { Building2, CheckCircle2, Clock3, Eye, Loader2, XCircle } from "lucide-react";

import AvisoCRMWEB from "@/components/AvisoCRMWEB";

type Money = number;

interface PagamentoPrestacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContratoInfo {
  contrato: string;
  periodo_ate: string;
  data_pagto?: string | null;

  credor?: string | null;
  cpf?: string | null;
  nome?: string | null;
  endereco?: string | null;
  situacoes_especiais?: string | null;

  tipo_pagamento?: string | null;
  unidade_movimento?: string | null;
}

interface ResumoTotais {
  prestacoes_em_atraso: number;
  multa: Money;
  juros_moratorios: Money;
  juros_remuneratorios: Money;
  atualizacao_monetaria: Money;
  iof_complementar: Money;
  diferenca_prestacao: Money;
  encargo: Money;
  total: Money;
}

interface DetalhamentoAtrasoItem {
  prestacao: string;
  data_venc: string;
  multa: Money;
  juros_moratorios: Money;
  juros_remuneratorios: Money;
  atualizacao_monetaria: Money;
  iof_complementar: Money;
  diferenca_prestacao: Money;
  encargo: Money;
  total: Money;
  total_acumulado: Money;
}

interface DadosCoobrigado {
  nome?: string | null;
  cpf?: string | null;
}

type CoobrigadoResponse = Array<DadosCoobrigado | string> | string;

interface PagamentoPrestacaoResponse {
  status: "pendente" | "pendente1" | "pendente2" | "resolvido" | "falha" | "buscando";
  id_busca?: string;

  dados?: {
    contrato_info?: ContratoInfo;
    resultado_total?: ResumoTotais;
    detalhamento_atraso?: DetalhamentoAtrasoItem[];
    coobrigado?: CoobrigadoResponse;
  };
}

interface ConsultaCRMWEBParams {
  contrato: string;
  periodo_ate: string;
  data_pagto?: string;
  tipo_pagamento: number;
  buscar_coobrigado: 0 | 1;
}

interface ConsultaCRMWEBHistoryItem {
  key: string;
  createdAt: string;
  params: ConsultaCRMWEBParams;
  response: PagamentoPrestacaoResponse;
}

interface BuscaD9Item {
  marco: "base" | "d2" | "d4" | "d6" | "d9";
  data_pagto: string;
  id_busca: string;
  status: PagamentoPrestacaoResponse["status"];
  response?: PagamentoPrestacaoResponse;
}

interface BuscaCoobrigadoAutomatica {
  id_busca: string;
  status: "aguardando" | "concluido" | "falha";
}

const TIPOS_PAGAMENTO_EXEMPLO = [
  "310 QT PRE NORM RPP",
  "357 QT ISEN MULTA/JM RPP",
];

const CRMWEB_HISTORY_STORAGE_KEY = "crmweb-consultas-historico";
const CRMWEB_HISTORY_LIMIT = 15;
const COOBRIGADO_NAO_LOCALIZADO = "COOBRIGADO NÃO LOCALIZADO OU INEXISTENTE";

const normalizarListaCoobrigado = (
  value: CoobrigadoResponse | null | undefined,
): DadosCoobrigado[] => {
  if (Array.isArray(value)) {
    const itensNormalizados = value.flatMap((item) => {
      if (typeof item === "string" && item.trim()) {
        return [{ nome: item.trim(), cpf: null }];
      }

      if (item && typeof item === "object") {
        return [item];
      }

      return [];
    });

    if (itensNormalizados.length > 0) return itensNormalizados;
  }

  if (typeof value === "string" && value.trim()) {
    return [{ nome: value.trim(), cpf: null }];
  }
  return [{ nome: COOBRIGADO_NAO_LOCALIZADO, cpf: null }];
};

const possuiResultadoCoobrigado = (
  response: PagamentoPrestacaoResponse | null | undefined,
) =>
  Boolean(
    response?.dados &&
      Object.prototype.hasOwnProperty.call(response.dados, "coobrigado"),
  );

const toBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

const hoje = new Date();

const formatDate = (date: Date) => date.toISOString().split("T")[0];

const hojeFormatado = formatDate(hoje);

const maxPagamento = new Date();
maxPagamento.setDate(hoje.getDate() + 30);
const maxPagamentoFormatado = formatDate(maxPagamento);

const buildConsultaKey = (params: ConsultaCRMWEBParams) =>
  JSON.stringify({
    contrato: params.contrato.trim(),
    periodo_ate: params.periodo_ate.trim(),
    data_pagto: params.data_pagto?.trim() || "",
    tipo_pagamento: params.tipo_pagamento,
    buscar_coobrigado: params.buscar_coobrigado,
  });

const readConsultaHistory = (): ConsultaCRMWEBHistoryItem[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CRMWEB_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao carregar histórico CRMWEB:", error);
    return [];
  }
};

const writeConsultaHistory = (history: ConsultaCRMWEBHistoryItem[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CRMWEB_HISTORY_STORAGE_KEY,
      JSON.stringify(history),
    );
  } catch (error) {
    console.error("Erro ao salvar histórico CRMWEB:", error);
  }
};

const formatHistoryDateTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR");
};

function estaInoperante(data: Date = new Date()): boolean {
  const diaSemana = data.getDay(); // 0 = domingo, 6 = sábado
  const hora = data.getHours();

  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
  const apos20hDuranteSemana = diaSemana >= 1 && diaSemana <= 5 && hora >= 20;

  return fimDeSemana || apos20hDuranteSemana;
}

export default function PagamentoPrestacaoModal({
  isOpen,
  onClose,
}: PagamentoPrestacaoModalProps) {
  const parseBR = (v: string | number | null | undefined) => {
    if (!v) return 0;

    const str = String(v).trim();

    if (str.includes(".") && !str.includes(",")) {
      return Number(str);
    }

    return Number(str.replace(/\./g, "").replace(",", "."));
  };

  const { toast } = useToast();

  const [horarioComercial, setHorarioComercial] = useState(false);

  const [loading, setLoading] = useState(false);
  const [modoBusca, setModoBusca] = useState<"normal" | "d9" | null>(null);
  const [contrato, setContrato] = useState("");

  const hoje = new Date();
  const dataLocal =
    hoje.getFullYear() +
    "-" +
    String(hoje.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(hoje.getDate()).padStart(2, "0");

  const inputPagtoRef = useRef<HTMLInputElement>(null);

  const [periodoAte, setPeriodoAte] = useState(dataLocal);
  const [dataPagto, setDataPagto] = useState(dataLocal);
  const [tipoPagamento, setTipoPagamento] = useState<number>(0);
  const [idBusca, setIdBusca] = useState<string | null>(null);
  const [demorando, setDemorando] = useState<boolean>(false);
  const [data, setData] = useState<PagamentoPrestacaoResponse | null>(null);
  const [historicoConsultas, setHistoricoConsultas] = useState<
    ConsultaCRMWEBHistoryItem[]
  >([]);
  const [activeTab, setActiveTab] = useState("consulta");
  const [buscaDetalhe, setBuscaDetalhe] = useState("");
  const [msgErro, setMsgErro] = useState<string | null>(null);
  const [buscasD9, setBuscasD9] = useState<BuscaD9Item[]>([]);
  const buscasD9Ref = useRef<BuscaD9Item[]>([]);
  const contextoD9Ref = useRef<ConsultaCRMWEBParams | null>(null);
  const [buscaCoobrigadoAutomatica, setBuscaCoobrigadoAutomatica] =
    useState<BuscaCoobrigadoAutomatica | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setBuscaDetalhe("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setHistoricoConsultas(readConsultaHistory());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setHorarioComercial(estaInoperante());

    const interval = setInterval(() => {
      setHorarioComercial(estaInoperante());
    }, 60000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const canSearch = useMemo(() => {
    return (
      contrato.trim().length > 0 &&
      periodoAte.trim().length > 0 &&
      dataPagto.trim().length > 0 &&
      tipoPagamento != null
    );
  }, [contrato, periodoAte, dataPagto, tipoPagamento]);

  const pollingAtivo = useRef(true);
  const consultaEmAndamentoRef = useRef(false);

  useEffect(() => {
    pollingAtivo.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    buscasD9Ref.current = buscasD9;
  }, [buscasD9]);

  const chaveLoteD9 = buscasD9.map((busca) => busca.id_busca).join("|");

  useEffect(() => {
    if (!isOpen || !chaveLoteD9) return;

    let cancelado = false;
    let consultaEmAndamento = false;

    const consultarFilhos = async () => {
      if (consultaEmAndamento || cancelado) return;

      const pendentes = buscasD9Ref.current.filter(
        (busca) =>
          busca.marco !== "base" &&
          busca.status !== "falha" &&
          (busca.status !== "resolvido" ||
            !possuiResultadoCoobrigado(busca.response)),
      );

      if (pendentes.length === 0) return;

      consultaEmAndamento = true;

      try {
        const atualizacoes = await Promise.all(
          pendentes.map(async (busca) => {
            try {
              const response = await axiosInstance.get<PagamentoPrestacaoResponse>(
                `/api/consultar-crmweb/${busca.id_busca}`,
              );

              return {
                id_busca: busca.id_busca,
                response: {
                  ...response.data,
                  id_busca: busca.id_busca,
                },
              };
            } catch (error) {
              console.error(`Erro ao acompanhar ${busca.marco}:`, error);
              return null;
            }
          }),
        );

        if (cancelado) return;

        const atualizacoesValidas = new Map(
          atualizacoes
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .map((item) => [item.id_busca, item.response]),
        );

        setBuscasD9((atuais) =>
          atuais.map((busca) => {
            const response = atualizacoesValidas.get(busca.id_busca);
            if (!response) return busca;

            return {
              ...busca,
              status: response.status,
              response:
                response.status === "resolvido" || response.status === "falha"
                  ? response
                  : busca.response,
            };
          }),
        );
      } finally {
        consultaEmAndamento = false;
      }
    };

    void consultarFilhos();
    const interval = window.setInterval(consultarFilhos, INTERVALO);

    return () => {
      cancelado = true;
      window.clearInterval(interval);
    };
  }, [isOpen, chaveLoteD9]);

  const TEMPO_TOTAL = 90000;
  const INTERVALO = 2000;

  useEffect(() => {
    const acompanhamento = buscaCoobrigadoAutomatica;
    if (
      !isOpen ||
      !acompanhamento ||
      acompanhamento.status === "concluido" ||
      acompanhamento.status === "falha"
    ) {
      return;
    }

    let cancelado = false;
    let consultaEmAndamento = false;

    const consultarCoobrigado = async () => {
      if (cancelado || consultaEmAndamento) return;
      consultaEmAndamento = true;

      try {
        const response = await axiosInstance.get<PagamentoPrestacaoResponse>(
          `/api/consultar-crmweb/${acompanhamento.id_busca}`,
        );

        if (cancelado) return;

        if (
          response.data.status === "resolvido" &&
          possuiResultadoCoobrigado(response.data)
        ) {
          const listaCoobrigado = normalizarListaCoobrigado(
            response.data.dados?.coobrigado,
          );
          const respostaAtualizada: PagamentoPrestacaoResponse = {
            ...response.data,
            id_busca: acompanhamento.id_busca,
            dados: {
              ...response.data.dados,
              coobrigado: listaCoobrigado,
            },
          };
          setData((resultadoAtual) => {
            if (
              resultadoAtual?.status !== "resolvido" ||
              resultadoAtual.id_busca !== acompanhamento.id_busca
            ) {
              return resultadoAtual;
            }

            return respostaAtualizada;
          });

          setHistoricoConsultas((historicoAtual) => {
            const historicoAtualizado = historicoAtual.map((item) => {
              if (
                item.response.id_busca !== acompanhamento.id_busca
              ) {
                return item;
              }

              return {
                ...item,
                response: respostaAtualizada,
              };
            });

            writeConsultaHistory(historicoAtualizado);
            return historicoAtualizado;
          });

          setBuscasD9((buscasAtuais) =>
            buscasAtuais.map((busca) =>
              busca.id_busca === acompanhamento.id_busca
                ? {
                    ...busca,
                    status: respostaAtualizada.status,
                    response: respostaAtualizada,
                  }
                : busca,
            ),
          );

          setBuscaCoobrigadoAutomatica((atual) =>
            atual?.id_busca === acompanhamento.id_busca
              ? { ...atual, status: "concluido" }
              : atual,
          );
          return;
        }

        if (response.data.status === "falha") {
          setBuscaCoobrigadoAutomatica((atual) =>
            atual?.id_busca === acompanhamento.id_busca
              ? { ...atual, status: "falha" }
              : atual,
          );
          return;
        }

      } catch (error) {
        console.error("Erro ao acompanhar coobrigado:", error);
      } finally {
        consultaEmAndamento = false;
      }
    };

    void consultarCoobrigado();
    const interval = window.setInterval(consultarCoobrigado, INTERVALO);

    return () => {
      cancelado = true;
      window.clearInterval(interval);
    };
  }, [isOpen, buscaCoobrigadoAutomatica]);

  const acompanharCoobrigadoNaMesmaBusca = (
    idBuscaAtual: string,
  ) => {
    setBuscaCoobrigadoAutomatica({
      id_busca: idBuscaAtual,
      status: "aguardando",
    });
  };

  const salvarHistoricoConsulta = (
    params: ConsultaCRMWEBParams,
    response: PagamentoPrestacaoResponse,
  ) => {
    if (response.status !== "resolvido" || !response.dados) return;

    const item: ConsultaCRMWEBHistoryItem = {
      key: buildConsultaKey(params),
      createdAt: new Date().toISOString(),
      params,
      response,
    };

    setHistoricoConsultas((currentHistory) => {
      const historicoAtualizado = [
        item,
        ...currentHistory.filter((entry) => entry.key !== item.key),
      ].slice(0, CRMWEB_HISTORY_LIMIT);

      writeConsultaHistory(historicoAtualizado);
      return historicoAtualizado;
    });
  };

  const excluirHistoricoItem = (key: string) => {
    const confirmarExclusao = window.confirm(
      "Deseja realmente excluir este histórico?",
    );

    if (!confirmarExclusao) return;

    setHistoricoConsultas((currentHistory) => {
      const historicoAtualizado = currentHistory.filter(
        (item) => item.key !== key,
      );

      writeConsultaHistory(historicoAtualizado);
      return historicoAtualizado;
    });

    toast({
      title: "Histórico excluído",
      description: "O item selecionado foi removido do histórico.",
    });
  };

  const excluirTodoHistorico = () => {
    const confirmarExclusao = window.confirm(
      "Deseja realmente excluir todo o histórico?",
    );

    if (!confirmarExclusao) return;

    setHistoricoConsultas([]);
    writeConsultaHistory([]);

    toast({
      title: "Histórico limpo",
      description: "Todos os itens do histórico foram removidos.",
    });
  };

  const aplicarCoobrigadoDisponivel = (
    response: PagamentoPrestacaoResponse,
  ): PagamentoPrestacaoResponse => {
    if (!possuiResultadoCoobrigado(response)) return response;

    return {
      ...response,
      dados: {
        ...response.dados,
        coobrigado: normalizarListaCoobrigado(response.dados?.coobrigado),
      },
    };
  };

  const aplicarConsultaHistorica = (item: ConsultaCRMWEBHistoryItem) => {
    setContrato(item.params.contrato);
    setPeriodoAte(item.params.periodo_ate);
    setDataPagto(item.params.data_pagto || dataLocal);
    setTipoPagamento(item.params.tipo_pagamento);
    setData(aplicarCoobrigadoDisponivel(item.response));
    setIdBusca(item.response.id_busca || null);
    if (
      item.response.id_busca &&
      !possuiResultadoCoobrigado(item.response)
    ) {
      acompanharCoobrigadoNaMesmaBusca(item.response.id_busca);
    } else {
      setBuscaCoobrigadoAutomatica(null);
    }
    setMsgErro(null);
    setBuscaDetalhe("");
    setActiveTab("consulta");
  };

  const handleConsultarCache = async () => {
    // O estado do React so e atualizado no proximo render. A ref fecha
    // imediatamente a janela em que clique duplo/Enter poderia disparar
    // mais de uma criacao para a mesma consulta.
    if (consultaEmAndamentoRef.current) return;

    consultaEmAndamentoRef.current = true;
    setLoading(true);
    setModoBusca("normal");
    setBuscasD9([]);
    setBuscaCoobrigadoAutomatica(null);
    contextoD9Ref.current = null;

    const parametrosConsulta: ConsultaCRMWEBParams = {
      contrato: contrato.trim(),
      periodo_ate: periodoAte.trim(),
      data_pagto: dataPagto.trim() || undefined,
      tipo_pagamento: Number(tipoPagamento),
      buscar_coobrigado: 1,
    };

    try {
      try {
        const createResponse = await axiosInstance.get("/api/consultar-crmweb-cache", {
          params: {
            contrato: parametrosConsulta.contrato,
            periodo_ate: parametrosConsulta.periodo_ate,
            data_pagto: parametrosConsulta.data_pagto,
            tipo_pagamento: parametrosConsulta.tipo_pagamento,
            buscar_coobrigado: parametrosConsulta.buscar_coobrigado,
          },
        });

        const { status } = createResponse.data;

        if (status !== "resolvido") {
          await handleConsultar();
        } else {
          const respostaCache: PagamentoPrestacaoResponse = {
            ...createResponse.data,
            id_busca: createResponse.data.id_busca
              ? String(createResponse.data.id_busca)
              : undefined,
          };
          const responseComCoobrigado = aplicarCoobrigadoDisponivel(
            respostaCache,
          );

          setData(responseComCoobrigado);
          salvarHistoricoConsulta(parametrosConsulta, responseComCoobrigado);
          if (
            respostaCache.id_busca &&
            !possuiResultadoCoobrigado(respostaCache)
          ) {
            acompanharCoobrigadoNaMesmaBusca(
              respostaCache.id_busca,
            );
          } else {
            setBuscaCoobrigadoAutomatica(null);
          }
        }
      } catch (error) {
        await handleConsultar();
      }
    } finally {
      consultaEmAndamentoRef.current = false;
      setLoading(false);
      setModoBusca(null);
    }
  };

  const acompanharBusca = async (
    buscaAtual: string,
    parametrosConsulta: ConsultaCRMWEBParams,
  ) => {
    setIdBusca(buscaAtual);

    const inicio = Date.now();

    while (Date.now() - inicio < TEMPO_TOTAL && pollingAtivo.current) {
      setDemorando(Date.now() - inicio >= 60000);

      let statusResponse;

      try {
        statusResponse = await axiosInstance.get(
          `/api/consultar-crmweb/${buscaAtual}`,
        );
      } catch (error) {
        console.error("Erro no polling:", error);
        await new Promise((resolve) => setTimeout(resolve, INTERVALO));
        continue;
      }

      const { status, dados } = statusResponse.data;

      if (status === "resolvido" && dados) {
        const respostaAtual: PagamentoPrestacaoResponse = {
          ...statusResponse.data,
          id_busca: buscaAtual,
        };
        const responseComCoobrigado = aplicarCoobrigadoDisponivel(
          respostaAtual,
        );

        setData(responseComCoobrigado);
        salvarHistoricoConsulta(parametrosConsulta, responseComCoobrigado);
        if (!possuiResultadoCoobrigado(respostaAtual)) {
          acompanharCoobrigadoNaMesmaBusca(buscaAtual);
        } else {
          setBuscaCoobrigadoAutomatica(null);
        }
        return;
      }

      if (status === "falha") {
        setBuscaDetalhe("");
        setIdBusca(null);
        setMsgErro(dados);
        setData(statusResponse.data);

        toast({
          title: "Erro",
          description: "Falha na consulta.",
          variant: "destructive",
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, INTERVALO));
    }

    setIdBusca(null);

    if (pollingAtivo.current) {
      toast({
        title: "Tempo excedido",
        description: "A consulta demorou mais do que o esperado.",
        variant: "destructive",
      });
    }
  };

  const handleConsultar = async () => {
    if (!canSearch) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Contrato e Data de Pagamento para consultar.",
        variant: "destructive",
      });
      return;
    }

    if (contrato.length !== 12) {
      toast({
        title: "Contrato inválido",
        description: "O contrato deve conter exatamente 12 dígitos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setIdBusca(null);
    setMsgErro(null);
    setActiveTab("consulta");

    const parametrosConsulta: ConsultaCRMWEBParams = {
      contrato: contrato.trim(),
      periodo_ate: periodoAte.trim(),
      data_pagto: dataPagto.trim() || undefined,
      tipo_pagamento: Number(tipoPagamento),
      buscar_coobrigado: 1,
    };

    const consultaEmHistorico = historicoConsultas.find(
      (item) => item.key === buildConsultaKey(parametrosConsulta),
    );

    if (consultaEmHistorico) {
      aplicarConsultaHistorica(consultaEmHistorico);
      setLoading(false);

      toast({
        title: "Consulta recuperada do histórico",
        description: "Os mesmos parâmetros já haviam sido consultados.",
      });
      return;
    }

    try {
      const createResponse = await axiosInstance.post(
        "/api/consultar-crmweb",
        {
          contrato: parametrosConsulta.contrato,
          periodo_ate: parametrosConsulta.periodo_ate,
          data_pagto: parametrosConsulta.data_pagto,
          tipo_pagamento: parametrosConsulta.tipo_pagamento,
          buscar_coobrigado: parametrosConsulta.buscar_coobrigado,
          usuario: localStorage.getItem("userCpf"),
        },
        { timeout: 60000 },
      );

      const buscaAtual = createResponse.data.id_busca;
      if (!buscaAtual) throw new Error("ID de busca não retornado");

      await acompanharBusca(buscaAtual, parametrosConsulta);
    } catch (err) {
      setIdBusca(null);

      toast({
        title: "Erro",
        description: "Não foi possível consultar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDemorando(false);
    }
  };

  const handleConsultarD9 = async () => {
    if (consultaEmAndamentoRef.current) return;

    if (!canSearch) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o contrato para consultar.",
        variant: "destructive",
      });
      return;
    }

    if (contrato.length !== 12) {
      toast({
        title: "Contrato inválido",
        description: "O contrato deve conter exatamente 12 dígitos",
        variant: "destructive",
      });
      return;
    }

    consultaEmAndamentoRef.current = true;
    setLoading(true);
    setModoBusca("d9");
    setIdBusca(null);
    setBuscaCoobrigadoAutomatica(null);
    setMsgErro(null);
    setActiveTab("consulta");

    try {
      const createResponse = await axiosInstance.post(
        "/api/consultar-crmweb-d9",
        {
          contrato: contrato.trim(),
          tipo_pagamento: Number(tipoPagamento),
          buscar_coobrigado: 1,
          usuario: localStorage.getItem("userCpf"),
        },
        { timeout: 60000 },
      );

      const buscaAtual = createResponse.data.id_busca;
      const periodoBase = createResponse.data.periodo_ate;
      const dataBase = createResponse.data.datas?.base;
      const buscasCriadas = createResponse.data.buscas;

      if (!buscaAtual || !periodoBase || !dataBase || !Array.isArray(buscasCriadas)) {
        throw new Error("Dados do lote D+9 não retornados");
      }

      const parametrosConsulta: ConsultaCRMWEBParams = {
        contrato: contrato.trim(),
        periodo_ate: periodoBase,
        data_pagto: dataBase,
        tipo_pagamento: Number(tipoPagamento),
        buscar_coobrigado: 1,
      };

      setPeriodoAte(periodoBase);
      setDataPagto(dataBase);
      contextoD9Ref.current = parametrosConsulta;
      setBuscasD9(
        buscasCriadas.map((busca) => ({
          marco: busca.marco,
          data_pagto: busca.data_pagto,
          id_busca: String(busca.id_busca),
          status: busca.status,
        })),
      );
      toast({
        title: "Pedidos D+9 registrados",
        description:
          "A busca de hoje tem prioridade; D+2, D+4, D+6 e D+9 ficaram na fila secundária.",
      });

      await acompanharBusca(buscaAtual, parametrosConsulta);
    } catch (error) {
      setIdBusca(null);

      toast({
        title: "Erro",
        description: "Não foi possível registrar os pedidos D+9.",
        variant: "destructive",
      });
    } finally {
      consultaEmAndamentoRef.current = false;
      setLoading(false);
      setDemorando(false);
      setModoBusca(null);
    }
  };

  const buscasSecundariasD9 = useMemo(
    () => buscasD9.filter((busca) => busca.marco !== "base"),
    [buscasD9],
  );

  const buscasSecundariasConcluidas = buscasSecundariasD9.filter(
    (busca) => busca.status === "resolvido",
  ).length;
  const buscasSecundariasComFalha = buscasSecundariasD9.filter(
    (busca) => busca.status === "falha",
  ).length;
  const todasBuscasSecundariasFinalizadas =
    buscasSecundariasD9.length > 0 &&
    buscasSecundariasConcluidas + buscasSecundariasComFalha ===
      buscasSecundariasD9.length;

  const abrirResultadoD9 = (busca: BuscaD9Item) => {
    if (busca.status !== "resolvido" || !busca.response?.dados) return;

    const contexto = contextoD9Ref.current;
    if (!contexto) return;

    const parametrosConsulta: ConsultaCRMWEBParams = {
      ...contexto,
      data_pagto: busca.data_pagto,
    };
    const respostaAtual: PagamentoPrestacaoResponse = {
      ...busca.response,
      id_busca: busca.id_busca,
    };
    const responseComCoobrigado = aplicarCoobrigadoDisponivel(
      respostaAtual,
    );

    setPeriodoAte(contexto.periodo_ate);
    setDataPagto(busca.data_pagto);
    setData(responseComCoobrigado);
    setIdBusca(busca.id_busca);
    setMsgErro(null);
    setBuscaDetalhe("");
    setActiveTab("consulta");
    salvarHistoricoConsulta(parametrosConsulta, responseComCoobrigado);
    if (!possuiResultadoCoobrigado(respostaAtual)) {
      acompanharCoobrigadoNaMesmaBusca(busca.id_busca);
    } else {
      setBuscaCoobrigadoAutomatica(null);
    }
  };

  const detalhamentoFiltrado = useMemo(() => {
    if (!data?.dados?.detalhamento_atraso) return [];

    const q = buscaDetalhe.trim().toLowerCase();

    if (!q) return data.dados.detalhamento_atraso;

    return data.dados.detalhamento_atraso.filter((item) => {
      return (
        item.prestacao.toLowerCase().includes(q) ||
        item.data_venc.toLowerCase().includes(q)
      );
    });
  }, [data, buscaDetalhe]);

  const contratoInfo = data?.dados?.contrato_info;
  const valorCoobrigado = data?.dados?.coobrigado;
  const dadosCoobrigado =
    (Array.isArray(valorCoobrigado) && valorCoobrigado.length > 0) ||
    (typeof valorCoobrigado === "string" && valorCoobrigado.trim())
      ? normalizarListaCoobrigado(valorCoobrigado)
      : [];
  const buscaCoobrigadoDaConsultaAtual =
    buscaCoobrigadoAutomatica &&
    buscaCoobrigadoAutomatica.id_busca === data?.id_busca
      ? buscaCoobrigadoAutomatica
      : null;
  const buscandoCoobrigado =
    buscaCoobrigadoDaConsultaAtual &&
    buscaCoobrigadoDaConsultaAtual.status === "aguardando";
  const resumo = data?.dados?.resultado_total;

  return (
    <>{horarioComercial ? (<> <AvisoCRMWEB isOpen={isOpen} onClose={onClose}/> </>):
    (<Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="consulta-crmweb-hud max-h-[90vh] w-[calc(100vw-2rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl border border-blue-400/50 bg-[#020b18] p-0 text-slate-100 shadow-[0_0_70px_rgba(37,99,235,.22),inset_0_0_55px_rgba(37,99,235,.035)] sm:w-[calc(100vw-4rem)]">
        <DialogHeader className="consulta-crmweb-hud__header z-30 border-b border-blue-500/25 px-5 py-5 pr-16 text-left">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold tracking-tight text-slate-100">
            <span className="rounded-md border border-blue-400/50 bg-blue-500/10 p-2 text-blue-300 shadow-[0_0_18px_rgba(59,130,246,.25)]"><Building2 className="h-5 w-5" /></span>
            Consulta de contrato habitacional VEGA
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="relative min-h-0 w-full overflow-y-auto px-4 pb-5 md:px-5">
          <TabsList className="mt-4 grid w-full grid-cols-2 rounded-md border border-blue-500/30 bg-[#031022]/90 p-1">
            <TabsTrigger value="consulta" className="rounded-sm text-blue-200/55 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-100 data-[state=active]:shadow-[0_0_14px_rgba(59,130,246,.14)]">Consultar</TabsTrigger>
            <TabsTrigger value="historico" className="rounded-sm text-blue-200/55 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-100 data-[state=active]:shadow-[0_0_14px_rgba(59,130,246,.14)]">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="consulta" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 gap-[2vh]">
                  <div className="flex flex-col md:flex-row justify-between gap-[2vh]">
                    <div className="space-y-2 w-full">
                      <Label>Contrato *</Label>
                      <Input
                        type="text"
                        value={contrato}
                        onChange={(e) => {
                          const somenteNumeros = e.target.value.replace(/\D/g, "");
                          const semZerosNoInicio = somenteNumeros.replace(/^0+/, "");
                          const contratoFinal = semZerosNoInicio.slice(0, 12);

                          setContrato(contratoFinal);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !loading && canSearch) {
                            handleConsultarCache();
                          }
                        }}
                        placeholder="Informe o contrato"
                        className={
                          contrato.length > 0 && contrato.length !== 12
                            ? "border-red-500"
                            : ""
                        }
                      />

                      {contrato.length > 0 && contrato.length !== 12 && (
                        <span className="text-xs text-red-500">
                          O contrato deve conter exatamente 12 dígitos
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 w-full">
                      <Label>Data de Pagamento *</Label>
                      <Input
                        ref={inputPagtoRef}
                        type="date"
                        value={dataPagto}
                        min={hojeFormatado}
                        max={maxPagamentoFormatado}
                        onChange={(e) => setDataPagto(e.target.value)}
                        onClick={() => inputPagtoRef.current?.showPicker()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !loading && canSearch) {
                            handleConsultarCache();
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                  
                {/* REMOVER CHAVE DE TIPO DE PAGAMENTO E SUBSTITUIR POR CHECKBOX DE CAMPANHA 532 --- IGNORE --- */}
                  <div className="space-y-2 hidden">
                    <Label>Tipo de Pagamento</Label>

                    <Select
                      value={tipoPagamento !== null ? String(tipoPagamento) : ""}
                      onValueChange={(v) => setTipoPagamento(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>

                      <SelectContent>
                        {TIPOS_PAGAMENTO_EXEMPLO.map((t, index) => (
                          <SelectItem key={t} value={String(index)}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-4 md:flex-row justify-between">
                  <div className="grid grid-cols-1 gap-2">
                    {/* Campanha 532 */}
                    <label className="order-1 md:order-0 cursor-pointer rounded-sm h-8 w-full md:w-60">
                      <input
                        type="checkbox"
                        checked={tipoPagamento === 1}
                        onChange={(e) => setTipoPagamento(e.target.checked ? 1 : 0)}
                        className="peer hidden"
                      />

                      <div
                        className="flex h-8 w-full justify-center rounded-md border border-blue-500/35 bg-blue-500/[0.04] text-blue-200/50 transition-all hover:border-blue-400/65 peer-checked:border-blue-400 peer-checked:bg-blue-500/25 peer-checked:text-blue-100 peer-checked:shadow-[0_0_14px_rgba(59,130,246,.16)] md:w-60"
                      >
                        <div className="flex items-center">
                          <div>
                            <p className="text-sm font-semibold">
                              Campanha 532
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>

                    {/* D+6 */}
                    {/* <label className="order-0 md:order-1 cursor-pointer rounded-sm h-8 w-full md:w-40 gap-2">
                      <input
                        type="checkbox"
                        // checked={buscarD6}
                        // onChange={(e) => setBuscarD6(e.target.checked)}
                        className="peer hidden"
                      />

                      <div className="flex justify-center h-8 w-full md:w-40 border border-gray-800 dark:border-gray-300 rounded-lg 
                                      peer-checked:border-gray-300 peer-checked:bg-gray-300 dark:peer-checked:border-white dark:peer-checked:bg-white
                                      peer-checked:text-blue-950 text-gray-400
                                      hover:border-gray-400 transition-all">
                        
                        <div className="flex items-center">
                          <p className="text-sm font-semibold">
                            Buscar D+6
                          </p>
                        </div>
                      </div>
                    </label> */}
                  </div>

                  <div className="flex gap-2 justify-between md:justify-end mt-4 md:mt-0">
                    <Button
                      variant="outline"
                      className="rounded-md border-blue-500/35 bg-transparent text-blue-200/65 hover:bg-blue-500/10 hover:text-blue-100"
                      onClick={() => {
                        setContrato("");
                        setPeriodoAte(dataLocal);
                        setDataPagto(dataLocal);
                        setData(null);
                        setBuscaDetalhe("");
                        setBuscasD9([]);
                        contextoD9Ref.current = null;
                      }}
                    >
                      Limpar
                    </Button>

                    <Button onClick={handleConsultarCache} disabled={loading || !canSearch} className="rounded-md border border-blue-400/60 bg-blue-600 text-white shadow-[0_0_18px_rgba(37,99,235,.22)] hover:bg-blue-500">
                      {loading && modoBusca === "normal" ? "Consultando..." : "Consultar"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleConsultarD9}
                      disabled={loading || !canSearch}
                      className="rounded-md border-blue-400/60 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 hover:text-white"
                    >
                      {loading && modoBusca === "d9" ? "Registrando D+9..." : "Buscar D+9"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {buscasSecundariasD9.length > 0 && (
              <Card className="border-blue-500/30 bg-blue-950/20">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-blue-100">
                        Acompanhamento D+9
                      </div>
                      <div className="text-xs text-blue-200/60">
                        {buscasSecundariasConcluidas} de {buscasSecundariasD9.length} consultas concluídas
                      </div>
                    </div>

                    {todasBuscasSecundariasFinalizadas && buscasSecundariasComFalha === 0 ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> Todas concluídas
                      </span>
                    ) : todasBuscasSecundariasFinalizadas ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-300">
                        <XCircle className="h-4 w-4" /> Finalizado com {buscasSecundariasComFalha} falha(s)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-blue-300/75">
                        <Loader2 className="h-4 w-4 animate-spin" /> Processando em segundo plano
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {buscasSecundariasD9.map((busca) => {
                      const resolvida = busca.status === "resolvido";
                      const falhou = busca.status === "falha";
                      const processando = busca.status === "buscando";
                      const rotulo = busca.marco.toUpperCase().replace("D", "D+");

                      return (
                        <button
                          key={busca.id_busca}
                          type="button"
                          disabled={!resolvida}
                          onClick={() => abrirResultadoD9(busca)}
                          className="flex items-center justify-between gap-3 rounded-md border border-blue-500/25 bg-[#031022]/80 px-3 py-3 text-left transition hover:border-blue-400/60 hover:bg-blue-500/10 disabled:cursor-default disabled:hover:border-blue-500/25 disabled:hover:bg-[#031022]/80"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-blue-100">
                              {rotulo}
                            </span>
                            <span className="block text-xs text-blue-200/55">
                              {new Date(`${busca.data_pagto}T00:00:00`).toLocaleDateString("pt-BR")}
                            </span>
                          </span>

                          {resolvida ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-300">
                              <Eye className="h-4 w-4" /> Abrir
                            </span>
                          ) : falhou ? (
                            <span className="flex items-center gap-1 text-xs text-red-300">
                              <XCircle className="h-4 w-4" /> Falhou
                            </span>
                          ) : processando ? (
                            <span className="flex items-center gap-1 text-xs text-blue-300">
                              <Loader2 className="h-4 w-4 animate-spin" /> Buscando
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-300">
                              <Clock3 className="h-4 w-4" /> Pendente
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <>
              {loading ? (
                <div className="w-full h-full justify-items-center text-center text-xl font-bold">
                  <div className="relative animate-pulse mb-2">Carregando...</div>
                  {demorando ? (<div className="text-orange-400 font-normal">O portal da VEGA pode estar enfrentando instabilidade ou lentidão no momento.</div>):(<></>)}
                </div>
              ) : (
                <></>
              )}
            </>

            {data?.status !== "resolvido" ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Preencha os filtros e clique em Consultar.
                </div>

                {data?.status === "falha" && (
                  <div className="">
                    <div className="rounded-full bg-red-500 max-w-max px-4 text-start">{msgErro}</div>
                    <div>Por favor, verifique se o número do contrato está correto e se corresponde a um contrato <span className="text-yellow-400 font-bold">Habitacional</span></div>
                  </div>
                )}
              </>
            ) : (
              <div
                key={`${contratoInfo?.contrato || "contrato"}-${contratoInfo?.data_pagto || dataPagto}`}
                className={loading
                  ? "consulta-crmweb-result-enter pointer-events-none h-auto w-full space-y-4 rounded-lg bg-gray-700/30 animate-pulse"
                  : "consulta-crmweb-result-enter space-y-4 bg-transparent"}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card className="md:col-span-1">
                    <CardContent className="p-4 space-y-2">
                      <Card className="md:col-span-1">
                        <CardContent className="consulta-crmweb-result-text-group p-4 space-y-2">
                          <div>
                            <div className="text-sm font-semibold">Data de Pagamento</div>
                            <div className="consulta-crmweb-result-value text-sm text-muted-foreground">
                              {contratoInfo?.data_pagto || "-"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardContent className="consulta-crmweb-result-text-group p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-semibold">Nome</div>
                          <div className="consulta-crmweb-result-value text-sm text-muted-foreground">
                            {contratoInfo?.nome || "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">Contrato</div>
                          <div className="consulta-crmweb-result-value text-sm text-muted-foreground">
                            {contratoInfo?.contrato || "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold mt-3">CPF</div>
                          <div className="consulta-crmweb-result-value text-sm text-muted-foreground">
                            {contratoInfo?.cpf || "-"}
                          </div>
                        </div>
                      <div>
                        <div className="text-sm font-semibold">Coobrigado</div>
                        {dadosCoobrigado.length > 0 ? (
                          dadosCoobrigado.map((c, i) => (
                            <div key={i} className="text-sm text-muted-foreground">
                              Nome: <span className="consulta-crmweb-result-value inline-block">{c?.nome || "-"}</span> | <br />
                              CPF: <span className="consulta-crmweb-result-value inline-block">{c?.cpf ?
                              (c?.cpf.slice(3,6) + '.' + c?.cpf.slice(6,9) + '.' + c?.cpf.slice(9,12) + '-' + c?.cpf.slice(12,14)):
                              ('-')}</span>
                            </div>
                          ))
                        ) : buscandoCoobrigado ? (
                          <div className="flex items-center gap-2 text-sm text-blue-300/70">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando em segundo plano...
                          </div>
                        ) : buscaCoobrigadoDaConsultaAtual?.status === "falha" ? (
                          <div className="text-sm text-red-300/75">
                            Não foi possível consultar o coobrigado.
                          </div>
                        ) : (
                          <div className="consulta-crmweb-result-value text-sm text-muted-foreground">-</div>
                        )}
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardContent className="consulta-crmweb-result-text-group p-4 space-y-3">
                    <div className="text-sm font-bold">Resumo (Totais)</div>

                    {/* MOBILE (empilhado) */}
                    <div className="sm:hidden space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prestações em Atraso</span>
                        <span>{resumo?.prestacoes_em_atraso ?? 0}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Multa</span>
                        <span>{toBRL(parseBR(resumo?.multa))}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Juros Moratórios</span>
                        <span>{toBRL(parseBR(resumo?.juros_moratorios))}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Juros Remuneratórios</span>
                        <span>{toBRL(parseBR(resumo?.juros_remuneratorios))}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Encargo</span>
                        <span>{toBRL(parseBR(resumo?.encargo))}</span>
                      </div>

                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>{toBRL(parseBR(resumo?.total))}</span>
                      </div>
                    </div>

                    {/* DESKTOP (tabela) */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prestações em Atraso</TableHead>
                            <TableHead>Multa</TableHead>
                            <TableHead>Juros Moratórios</TableHead>
                            <TableHead>Juros Remuneratórios</TableHead>
                            <TableHead>Encargo</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          <TableRow>
                            <TableCell>{resumo?.prestacoes_em_atraso ?? 0}</TableCell>
                            <TableCell>{toBRL(parseBR(resumo?.multa))}</TableCell>
                            <TableCell>{toBRL(parseBR(resumo?.juros_moratorios))}</TableCell>
                            <TableCell>{toBRL(parseBR(resumo?.juros_remuneratorios))}</TableCell>
                            <TableCell>{toBRL(parseBR(resumo?.encargo))}</TableCell>
                            <TableCell className="font-semibold">
                              {toBRL(parseBR(resumo?.total))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="consulta-crmweb-result-text-group p-4 space-y-4">
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm font-bold">Detalhamento Atraso</div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                        <Label className="text-xs text-muted-foreground">
                          Pesquisar
                        </Label>
                        <Input
                          className="w-full sm:w-[260px]"
                          placeholder="Prestação ou data venc."
                          value={buscaDetalhe}
                          onChange={(e) => setBuscaDetalhe(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* MOBILE (cards empilhados) */}
                    <div className="sm:hidden space-y-3">
                      {detalhamentoFiltrado.length === 0 ? (
                        <div className="text-center text-sm">Nenhum item encontrado.</div>
                      ) : (
                        detalhamentoFiltrado.map((row, idx) => (
                          <div
                            key={`${row.prestacao}-${idx}`}
                            className="border rounded-lg p-3 space-y-2 text-sm"
                          >
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Prestação</span>
                              <span>{row.prestacao}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Data Venc.</span>
                              <span>
                                {(() => {
                                  const dataParcela = row.data_venc;
                                  const dia = dataParcela.slice(0, 2);
                                  const mes = dataParcela.slice(3, 5);
                                  const ano = "20" + dataParcela.slice(6, 8);
                                  return `${dia}/${mes}/${ano}`;
                                })()}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Multa</span>
                              <span>{toBRL(parseBR(row.multa))}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Juros Moratórios</span>
                              <span>{toBRL(parseBR(row.juros_moratorios))}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Juros Remuneratórios</span>
                              <span>{toBRL(parseBR(row.juros_remuneratorios))}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Encargo</span>
                              <span>{toBRL(parseBR(row.encargo))}</span>
                            </div>

                            <div className="flex justify-between font-medium">
                              <span>Total</span>
                              <span>{toBRL(parseBR(row.total))}</span>
                            </div>

                            <div className="flex justify-between font-semibold">
                              <span>Total Acumulado</span>
                              <span>{toBRL(parseBR(row.total_acumulado))}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* DESKTOP (tabela normal) */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prestação</TableHead>
                            <TableHead>Data Venc.</TableHead>
                            <TableHead>Multa</TableHead>
                            <TableHead>Juros Moratórios</TableHead>
                            <TableHead>Juros Remuneratórios</TableHead>
                            <TableHead>Encargo</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Total Acumulado</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {detalhamentoFiltrado.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center">
                                Nenhum item encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            detalhamentoFiltrado.map((row, idx) => (
                              <TableRow key={`${row.prestacao}-${idx}`}>
                                <TableCell>{row.prestacao}</TableCell>
                                <TableCell>
                                  {(() => {
                                    const dataParcela = row.data_venc;
                                    const dia = dataParcela.slice(0, 2);
                                    const mes = dataParcela.slice(3, 5);
                                    const ano = "20" + dataParcela.slice(6, 8);
                                    return `${dia}/${mes}/${ano}`;
                                  })()}
                                </TableCell>
                                <TableCell>{toBRL(parseBR(row.multa))}</TableCell>
                                <TableCell>{toBRL(parseBR(row.juros_moratorios))}</TableCell>
                                <TableCell>
                                  {toBRL(parseBR(row.juros_remuneratorios))}
                                </TableCell>
                                <TableCell>{toBRL(parseBR(row.encargo))}</TableCell>
                                <TableCell className="font-medium">
                                  {toBRL(parseBR(row.total))}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {toBRL(parseBR(row.total_acumulado))}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
              )}
          </TabsContent>

          <TabsContent value="historico" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-bold">Histórico de buscas</div>
                  <div className="text-xs text-muted-foreground">
                    Consultas resolvidas são reaproveitadas automaticamente quando os
                    parâmetros forem idênticos.
                  </div>
                </div>

                {historicoConsultas.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={excluirTodoHistorico}
                    >
                      Excluir todos
                    </Button>
                  </div>
                )}

                {historicoConsultas.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhuma consulta salva até o momento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historicoConsultas.map((item) => {
                      const resumoHistorico = item.response.dados?.resultado_total;
                      const detalhesHistorico =
                        item.response.dados?.detalhamento_atraso ?? [];

                      return (
                        <div
                          key={item.key}
                          className="border rounded-lg p-3 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold">
                                Contrato {item.params.contrato}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Salvo em {formatHistoryDateTime(item.createdAt)}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                aplicarConsultaHistorica(item);
                                toast({
                                  title: "Histórico aplicado",
                                  description:
                                    "Os parâmetros e resultados da consulta foram carregados.",
                                });
                              }}
                            >
                              Usar histórico
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => excluirHistoricoItem(item.key)}
                            >
                              Excluir
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Data de pagamento:</span>{" "}
                              {item.params.data_pagto || "-"}
                            </div>
                            <div>
                              <span className="font-medium">Tipo pagto:</span>{" "}
                              {TIPOS_PAGAMENTO_EXEMPLO[item.params.tipo_pagamento] ||
                                item.params.tipo_pagamento}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="font-medium">
                                Prestações em atraso:
                              </span>{" "}
                              {resumoHistorico?.prestacoes_em_atraso ?? 0}
                            </div>
                            <div>
                              <span className="font-medium">Total resumo:</span>{" "}
                              {toBRL(parseBR(resumoHistorico?.total))}
                            </div>
                            <div>
                              <span className="font-medium">Itens detalhados:</span>{" "}
                              {detalhesHistorico.length}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>)}
    </>
  );
}

