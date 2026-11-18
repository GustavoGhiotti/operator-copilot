// src/utils/treeState.ts

import axiosInstance from "./axiosInstance";

export interface OrnamentSave {
  id: string;
  pos: { x: number; y: number; z: number };
}

export interface TreeVisualState {
  ornaments: OrnamentSave[];
}

// Chave do localStorage
// agora a chave depende do CPF
function storageKey(cpf: string) {
  return `natal_tree_visual_state_${cpf}`;
}

export async function premioDisponivel(id_operador: string) {
  try {
    const res = await axiosInstance.get(
      `/api/caixaanimada/${id_operador}`,
      { validateStatus: () => true } // <- permite capturar 403 sem cair no catch
    );

    // Se voltou 200 -> tem prêmio
    if (res.status === 200) {
      return true;
    }

    // Se voltou 403 -> não tem prêmio
    if (res.status === 403) {
      return false;
    }

    // Qualquer outra coisa -> trata como falso
    return false;
  } catch (err) {
    console.warn("Erro ao carregar estado do BD:", err);
    return false; // fallback
  }
}

export async function loadTreeState(cpf: string): Promise<TreeVisualState> {
  let localState: TreeVisualState = { ornaments: [] };

  // 1. tentar carregar do cache local POR CPF
  try {
    const raw = localStorage.getItem(storageKey(cpf));
    if (raw) localState = JSON.parse(raw);
  } catch {}

  // 2. carregar do banco
  try {
    const res = await axiosInstance.get(
      `/api/operador/${cpf}/estado-arvore`
    );

    const estado = res.data?.estado_arvore;

    if (estado) {
      const dbState = typeof estado === "string" ? JSON.parse(estado) : estado;

      // salva o estado específico desse CPF no localStorage
      localStorage.setItem(storageKey(cpf), JSON.stringify(dbState));

      return dbState;
    }
  } catch (err) {
    console.warn("Erro ao carregar estado do BD:", err);
  }

  // fallback: retorna cache local
  return localState;
}

export async function saveTreeState(cpf: string, state: TreeVisualState) {
  const json = JSON.stringify(state);

  try {
    localStorage.setItem(storageKey(cpf), json);
  } catch {}

  try {
    await axiosInstance.put(
      `/api/operador/${cpf}/estado-arvore`,
      { estado_arvore: json }
    );
  } catch (err) {
    console.warn("Erro ao salvar estado no BD:", err);
  }
}

export async function loadMetaProgressState(cpf: string) {
  const metasKey = `metas_concluidas_dia_${cpf}`;
  const usoKey = `uso_de_enfeites_${cpf}`;

  try {
    const res = await axiosInstance.get(
      `/api/operador/${cpf}/estado-metas`
    );

    if (res.data) {
      if (res.data.metas_concluidas_dia) {
        localStorage.setItem(metasKey, res.data.metas_concluidas_dia);
      }

      if (res.data.uso_de_enfeites) {
        localStorage.setItem(usoKey, res.data.uso_de_enfeites);
      }
    }
  } catch (err) {
    console.warn("Erro ao carregar metas do BD:", err);
  }
}

export async function saveMetaProgressState(cpf: string) {
  const metasKey = `metas_concluidas_dia_${cpf}`;
  const usoKey = `uso_de_enfeites_${cpf}`;

  const metasJson = localStorage.getItem(metasKey) || "{}";
  const usoJson = localStorage.getItem(usoKey) || "{}";

  try {
    await axiosInstance.put(
      `/api/operador/${cpf}/estado-metas`,
      {
        metas_concluidas_dia: metasJson ?? 0,
        uso_de_enfeites: usoJson ?? {},
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.warn("Erro ao salvar estado das metas no BD:", err);
  }
}
