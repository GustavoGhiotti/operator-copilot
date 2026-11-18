import axiosInstance from "@/utils/axiosInstance";

/**
 * Carteiras que ganharam o @IA por terem treinamento cadastrado.
 *
 * Complementa a lista fixa do SearchBar — nunca a substitui. Quem já via o
 * comando continua vendo mesmo que a carteira ainda não tenha nenhuma ficha;
 * o que esta lista faz é abrir carteiras novas sem precisar de deploy.
 *
 * A promessa é memorizada no módulo porque há mais de um SearchBar montado por
 * página: sem isso, a mesma lista seria buscada duas ou três vezes por abertura.
 */
let cache: Promise<string[]> | null = null;

export const carregarCarteirasIA = (): Promise<string[]> => {
  if (!cache) {
    cache = axiosInstance
      .get<{ carteiras: string[] }>("/api/ia/carteiras-habilitadas")
      .then(({ data }) =>
        (data.carteiras ?? [])
          .map((carteira) => carteira.trim().toUpperCase())
          .filter(Boolean),
      )
      .catch(() => {
        // Sem a lista dinâmica a tela fica com a fixa, que é o comportamento
        // de antes. Zera o cache para a próxima abertura tentar de novo.
        cache = null;
        return [];
      });
  }
  return cache;
};

/**
 * O centro de custo do operador é coberto por alguma carteira com treinamento?
 *
 * Compara nos dois sentidos porque os dois nomes divergem na prática: o
 * treinamento é cadastrado como "BANCO DELTA" e o centro de custo do
 * operador é "BANCO DELTA DIGITAL", mas também existe o inverso. É a mesma
 * lógica que o backend usa para escolher qual treinamento entra na resposta.
 */
export const carteiraTemIA = (
  centroCusto: string,
  carteiras: string[],
): boolean => {
  const centro = (centroCusto || "").trim().toUpperCase();
  if (!centro) return false;

  return carteiras.some(
    (carteira) =>
      carteira.length > 0 &&
      (centro.includes(carteira) || carteira.includes(centro)),
  );
};
