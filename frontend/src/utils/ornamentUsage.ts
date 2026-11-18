export type OrnamentUsageRecord = {
  [cpf: string]: {
    totalConquistado: number;
    totalUsado: number;
  };
};

export function registrarOrnamentoUsado(cpf: string) {
  const key = `uso_de_enfeites_${cpf}`;
  const raw = localStorage.getItem(key);
  const db: OrnamentUsageRecord = raw ? JSON.parse(raw) : {};

  if (!db[cpf]) db[cpf] = { totalConquistado: 0, totalUsado: 0 };
  db[cpf].totalUsado += 1;

  localStorage.setItem(key, JSON.stringify(db));
}