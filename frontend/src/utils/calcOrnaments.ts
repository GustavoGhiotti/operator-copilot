import { Meta } from "@/types/natal";

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

export function calcularOrnamentLimitComControle(cpf: string, metas: Meta[]) {
  const hoje = new Date().toISOString().split("T")[0];

  const metaStorageKey = `metas_concluidas_dia_${cpf}`;
  const usoStorageKey = `uso_de_enfeites_${cpf}`;

  const storedMeta = localStorage.getItem(metaStorageKey);
  const storedUso = localStorage.getItem(usoStorageKey);

  let metaDb: DailyMetaRecord = {};
  let usoDb: OrnamentUsageRecord = {};

  try {
    metaDb = storedMeta ? JSON.parse(storedMeta) : {};
  } catch {}

  try {
    usoDb = storedUso ? JSON.parse(storedUso) : {};
  } catch {}

  if (!metaDb[cpf]) metaDb[cpf] = {};
  if (!usoDb[cpf]) usoDb[cpf] = { totalConquistado: 0, totalUsado: 0 };

  let somaHoje = 0;

  const { totalConquistado, totalUsado } = usoDb[cpf];
  const pendente = totalConquistado - totalUsado;

  if (pendente > 0) return pendente;

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

  localStorage.setItem(metaStorageKey, JSON.stringify(metaDb));
  localStorage.setItem(usoStorageKey, JSON.stringify(usoDb));

  return usoDb[cpf].totalConquistado - usoDb[cpf].totalUsado;
}
