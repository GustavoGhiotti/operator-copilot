import { useCallback, useEffect, useState } from "react";

import axiosInstance from "@/utils/axiosInstance";

/**
 * Carrega o fluxo que alimenta uma aba do roteiro (Tabulações, Outras
 * Situações, Canais de Atendimento, Banco de Argumentação).
 *
 * Quem decide qual fluxo é o de cada aba é o servidor, em `/roteiro/abas`:
 * ele usa o vínculo escolhido no @RoteiroAdm e, quando não há vínculo, cai no
 * casamento pelo nome do fluxo.
 *
 * Antes, cada aba fazia esse casamento sozinha, mandando o nome nos três
 * filtros de `mensagem-inicial`. Três das quatro abriam em branco: a de
 * Situações procurava "outras_situacoes" enquanto o cadastro se chama
 * "Situaçoes Adversas", a do Banco mandava um espaço extra no produto, e a de
 * Canais não achava nada porque o fluxo dela está sem nome no banco. O 404
 * caía num `catch` silencioso e a aba abria vazia.
 */

export type MensagemAuxiliar = {
  id_mensagem: string;
  titulo: string;
  mensagem: string;
};

export type EstadoFluxoAuxiliar = "carregando" | "ok" | "sem-cadastro" | "falha";

export type AbaRoteiro = {
  aba: string;
  rotulo: string;
  id_fluxo: string | null;
  produto: string;
  /** "vinculo" = escolhido na tela; "nome" = deduzido; "sem-fluxo" = nenhum. */
  origem: "vinculo" | "nome" | "sem-fluxo";
  /** false enquanto a tabela de vínculo não existir no ambiente. */
  editavel: boolean;
};

export const listarAbasRoteiro = async (): Promise<AbaRoteiro[]> => {
  const { data } = await axiosInstance.get<AbaRoteiro[]>("/api/roteiro/abas");
  return data || [];
};

export const vincularAbaRoteiro = async (aba: string, idFluxo: string | null) => {
  await axiosInstance.put(`/api/roteiro/abas/${encodeURIComponent(aba)}`, {
    id_fluxo: idFluxo,
    definido_por: localStorage.getItem("userCpf") || "",
  });
};

export const useFluxoAuxiliar = (aba: string) => {
  const [mensagens, setMensagens] = useState<MensagemAuxiliar[]>([]);
  const [estado, setEstado] = useState<EstadoFluxoAuxiliar>("carregando");
  const [origem, setOrigem] = useState<AbaRoteiro["origem"]>("sem-fluxo");

  const carregar = useCallback(async () => {
    setEstado("carregando");

    try {
      const abas = await listarAbasRoteiro();
      const alvo = abas.find((item) => item.aba === aba) || null;

      setOrigem(alvo?.origem ?? "sem-fluxo");

      if (!alvo?.id_fluxo) {
        setMensagens([]);
        setEstado("sem-cadastro");
        return;
      }

      const detalhe = await axiosInstance.get(
        `/api/roteiro/fluxo/${alvo.id_fluxo}`,
      );
      const encontradas: MensagemAuxiliar[] =
        detalhe.data?.fluxo?.mensagens || [];

      setMensagens(encontradas);
      setEstado(encontradas.length ? "ok" : "sem-cadastro");
    } catch (erro) {
      console.error("Erro ao carregar o fluxo da aba:", erro);
      setMensagens([]);
      setEstado("falha");
    }
  }, [aba]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { mensagens, estado, origem, recarregar: carregar };
};
