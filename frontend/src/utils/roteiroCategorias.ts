/**
 * As abas do roteiro, em um lugar só.
 *
 * Existiam duas cópias desta lista — uma no RoteiroVega e outra no
 * BasesAuxiliaresPage, que o RoteiroVegaAdm importava. Elas divergiram: a
 * correção do rótulo "Outras Sutituações" entrou só numa, e a tela do admin
 * continuou exibindo o erro de digitação.
 *
 * `value` é a chave usada na comparação com `categoriaAtiva` e, para as abas
 * auxiliares, é também o que o backend conhece em `/roteiro/abas`.
 */
export type CategoriaRoteiro = {
  value: string;
  label: string;
  color: string;
};

export const categorias: CategoriaRoteiro[] = [
  {
    value: "Roteiro",
    label: "Roteiro",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "Tabulações",
    label: "Tabulações",
    color: "bg-green-100 text-green-800 border-green-200",
  },
  {
    value: "outras_situacoes",
    label: "Outras Situações",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    value: "Banco de Argumentação",
    label: "Banco de Argumentação",
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    value: "Canais de Atendimento",
    label: "Canais de Atendimento",
    color: "bg-red-100 text-red-800 border-red-200",
  },
];
