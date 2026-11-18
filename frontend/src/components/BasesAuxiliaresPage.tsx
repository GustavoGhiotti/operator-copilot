/**
 * Este arquivo guardava uma segunda cópia da lista de abas do roteiro, e era
 * dela que a tela de administração lia — por isso a correção do rótulo
 * "Outras Sutituações" não aparecia lá. A lista agora vive em
 * `utils/roteiroCategorias`; o reexport fica para não quebrar quem importa
 * daqui.
 *
 * O componente padrão nunca teve corpo (`function BasesAuxiliaresPage() {}`) e
 * nunca foi renderizado — só importado.
 */
export { categorias, type CategoriaRoteiro } from "@/utils/roteiroCategorias";
