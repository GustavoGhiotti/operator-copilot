/**
 * Leitura de FUNCAO_COLABORADOR.
 *
 * O valor que vem do banco não é limpo. Existem registros com sufixo de nivel
 * ("SUPERVISOR(A) DE OPERACOES I"), com separador solto ("NEGOCIADOR |") e com
 * espaços de padding. Comparar por igualdade contra uma lista de cargos falha
 * em todos esses casos — e falha em silêncio, tirando permissão de quem
 * deveria ter.
 *
 * A regra aqui é comparar por PREFIXO sobre o valor normalizado: o cargo base
 * abre a string, e o que vier depois (nível, sufixo, sujeira) não interfere.
 * Prefixo em vez de "contém" porque "contém" criaria falso positivo — o cargo
 * "ASSISTENTE DE SUPERVISAO" contém "SUPERVISAO" sem ser supervisão.
 */

export const normalizarFuncao = (valor: string | null | undefined): string =>
  (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/** `true` se a função começa por algum dos cargos informados. */
export const funcaoEhAlgumDe = (
  valor: string | null | undefined,
  cargos: string[],
): boolean => {
  const funcao = normalizarFuncao(valor);
  if (!funcao) return false;
  return cargos.some((cargo) => funcao.startsWith(normalizarFuncao(cargo)));
};

/** Lê a função do usuário logado já normalizada. */
export const funcaoDoUsuario = (): string => {
  try {
    return normalizarFuncao(localStorage.getItem("funcao"));
  } catch {
    return "";
  }
};
