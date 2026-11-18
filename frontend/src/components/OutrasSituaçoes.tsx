import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance"; // ajuste o path para o seu
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "./ui/button";
import {
  formats,
  linkify,
  MensagemFluxo,
  modules,
  OpcaoFluxo,
  SelectOption,
} from "./RoteiroVegaAdm";
import axios from "axios";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import { Trash2 } from "lucide-react";

export default function OutrasSituaçoes() {
  const [mensagens, setMensagens] = useState([]);
  const [mensagemSelecionada, setMensagemSelecionada] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensagemAberta, setMensagemAberta] = useState<string | null>(null);
  const [mensagemEditandoId, setMensagemEditandoId] = useState<string | null>(
    null
  );
  const [fluxoEditandoId, setFluxoEditandoId] = useState<string | null>(null);
  const [tiposPessoa, setTiposPessoa] = useState<SelectOption[]>([]);
  const [conteudoEditado, setConteudoEditado] = useState<string>("");
  const [tituloEditado, setTituloEditado] = useState<string>("");
  const [ordemexibicaoEditada, setOrdemExibicaoEditada] = useState<number>();
  const [opcoesEditadas, setOpcoesEditadas] = useState<OpcaoFluxo[]>([]);
  const [roteiro, setRoteiro] = useState<MensagemFluxo[]>([]);
  const [modoEdicao, setModoEdicao] = useState<boolean>(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [tipoLigacaoSelecionado, setTipoLigacaoSelecionado] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [tipoClienteSelecionado, setTipoClienteSelecionado] = useState("");
  const [tipoLigacaoEditada, setTipoLigacaoEditada] = useState("");
  const [produtoEditada, setProdutoEditada] = useState("");
  const [tipoClienteEditada, setTipoClienteEditada] = useState("");
  const [fluxoCompleto, setFluxoCompleto] = useState<MensagemFluxo[]>([]);
  const [mensagemAnteriorEdicao, setMensagemAnteriorEdicao] =
    useState<MensagemFluxo | null>(null);
  const [mensagemAtual, setMensagemAtual] = useState<MensagemFluxo | null>(
    null
  );

  const nomeOperador = localStorage.getItem("nomeOperador") || "Operador";

  const buscarMensagensFluxo = async () => {
    try {
      setLoading(true);

      const params = {
        tipo_ligacao: "outras_situacoes",
        produto: "outras_situacoes",
        tipo_cliente: "outras_situacoes",
      };

      const response = await axiosInstance.get(
        "/api/roteiro/mensagem-inicial",
        {
          params,
        }
      );

      const msgs = response.data?.fluxo?.mensagens || [];
      if (msgs.length === 0) {
        return;
      }

      setMensagens(msgs);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    } finally {
      setLoading(false);
    }
  };
  const handleSalvarEdicao = async () => {
    try {
      if (!mensagemEditandoId) {
        handlecriar();
        return;
      }

      const payloadMensagem = {
        id_mensagem: mensagemEditandoId,
        id_fluxo: fluxoEditandoId,
        titulo: tituloEditado,
        ordem_exibicao: ordemexibicaoEditada,
        mensagem: conteudoEditado,
        opcoes: opcoesEditadas,
      };

      const idMensagemAtual = mensagemEditandoId;

      const response = await axios.put(
        `/api/roteiro/mensagem`,
        payloadMensagem
      );

      if (fluxoEditandoId) {
      }

      if (response.status === 200) {
        toast.success("Mensagem e opções atualizadas com sucesso!");
        setModoEdicao(false);
      }
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      toast.error("Erro ao salvar alterações.");
    }
  };

  const handleToggleEdicao = () => {
    setModoEdicao((prev) => {
      const entrandoEdicao = !prev;

      if (entrandoEdicao) {
        // entrando no modo edição
        if (mensagemAtual) {
          setTipoLigacaoEditada(tipoLigacaoSelecionado);
          setProdutoEditada(produtoSelecionado);
          setTipoClienteEditada(tipoClienteSelecionado);

          setMensagemEditandoId(mensagemAtual.id_mensagem || "");
          setFluxoEditandoId(mensagemAtual.id_fluxo || "");
          setTituloEditado(mensagemAtual.titulo || "");
          setOrdemExibicaoEditada(mensagemAtual.ordem_exibicao || 1);
          setConteudoEditado(mensagemAtual.mensagem || "");
          setOpcoesEditadas(
            mensagemAtual.opcoes
              ? mensagemAtual.opcoes.map((opcao) => ({
                  id_opcao: opcao.id_opcao,
                  texto_opcao: opcao.texto_opcao,
                  proxima_mensagem_id: opcao.proxima_mensagem_id,
                }))
              : []
          );
        }

        setMensagemAnteriorEdicao(mensagemAtual);
      } else {
        // saindo da edição, restaurar
        if (mensagemAnteriorEdicao) {
          setMensagemAtual(mensagemAnteriorEdicao);
        }
      }

      return entrandoEdicao;
    });
  };

  const handleSelecionarMensagem = (idMensagem: string) => {
    if (idMensagem === "__none__") {
      setMensagemSelecionada(null);
      setMensagemAtual(null);
      setMensagemEditandoId(null);
      setConteudoEditado("");
      setTituloEditado("");
      setModoEdicao(false);
      return;
    }

    const msg = mensagens.find((m) => m.id_mensagem === idMensagem);
    if (!msg) return;

    setMensagemSelecionada(msg);
    setMensagemAtual(msg);
    setMensagemEditandoId(msg.id_mensagem);
    setConteudoEditado(msg.mensagem);
    setTituloEditado(msg.titulo);
  };

  useEffect(() => {
    buscarMensagensFluxo();
  }, []);

  const handlecriar = async () => {
    try {
      const payloadMensagem = {
        id_mensagem: mensagemEditandoId,
        id_fluxo: fluxoEditandoId,
        titulo: tituloEditado,
        ordem_exibicao: ordemexibicaoEditada,
        mensagem: conteudoEditado,
        opcoes: opcoesEditadas,
      };

      const response = await axios.post(
        `/api/roteiro/situacoes`,
        payloadMensagem
      );

      if (fluxoEditandoId) {
      }

      if (response.status === 201) {
        toast.success("Mensagem e opções criadas com sucesso!");
        setModoEdicao(false);
      }
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      toast.error("Erro ao salvar alterações.");
    }
  };

  const handleExcluirMensagem = async (id_mensagem: string) => {
    try {
      if (!window.confirm("Deseja realmente excluir esta mensagem?")) return;

      const response = await axios.delete(
        `/api/roteiro/mensagem/${id_mensagem}`
      );
      const idMensagemAtual = mensagemEditandoId;

      if (response.status === 200) {
        toast.success("mensagem excluída com sucesso!");
        await handleSalvarEdicao();
        setModoEdicao(false);
      }
    } catch (error) {
      console.error("Erro ao excluir mensagem:", error);
      toast.error("Erro ao excluir mensagem. Verifique o console.");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold flex justify-between">
        Tabulação — Consulta de Mensagens
        <div>
          <Button
            className=" w-60"
            variant="ghost"
            size="icon"
            onClick={handleToggleEdicao}
          >
            {" "}
            EDITAR{" "}
          </Button>
        </div>
      </h2>
      {modoEdicao ? (
        <>
          <div>
            <Select onValueChange={handleSelecionarMensagem}>
              <SelectTrigger>
                <SelectValue
                  onClick={buscarMensagensFluxo}
                  placeholder="Selecione uma mensagem"
                />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-gray-400 italic">Nenhuma mensagem</span>
                </SelectItem>
                {mensagens.map((m) => (
                  <SelectItem key={m.id_mensagem} value={m.id_mensagem}>
                    <div dangerouslySetInnerHTML={{ __html: m.titulo }} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <>
            <ReactQuill
              theme="snow"
              value={tituloEditado}
              onChange={setTituloEditado}
              modules={modules}
              formats={formats}
              placeholder="Edite o conteúdo..."
              className="w-full bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              className="right-[5.9%] top-[25.8%] w-20 h-8 absolute"
              variant="destructive"
              size="icon"
              onClick={() => handleExcluirMensagem(mensagemAtual.id_mensagem)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>

          <>
            <ReactQuill
              theme="snow"
              value={conteudoEditado}
              onChange={setConteudoEditado}
              modules={modules}
              formats={formats}
              placeholder="Edite o conteúdo..."
              className="w-full bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              className="right-[5.9%] top-[25.8%] w-20 h-8 absolute"
              variant="destructive"
              size="icon"
              onClick={() =>
                handleExcluirMensagem(mensagemAtual?.id_mensagem || "TITULO")
              }
            >
              <Trash2 className="w-4 h-4" />
            </Button>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <Button onClick={handleSalvarEdicao} className="w-full">
                Salvar
              </Button>
              <Button
                onClick={handleToggleEdicao}
                variant="outline"
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </>
        </>
      ) : (
        <>
          {mensagemSelecionada && (
            <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
              <h3 className="text-md font-bold mb-2">
                <div
                  className="text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: mensagemSelecionada?.titulo || "MENSAGEM",
                  }}
                />
              </h3>
              <div
                className="prose prose-sm dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: mensagemSelecionada.mensagem,
                }}
              />
            </Card>
          )}
        </>
      )}
      {/* Select
      <div>
        <label className="text-sm font-medium block mb-2">
          Selecione uma mensagem do fluxo
        </label>
        <Select onValueChange={(value) => handleSelecionarMensagem(value)}>
          {mensagens.map((m) => (
            <SelectTrigger className="w-full bg-white dark:bg-gray-900">
              <div
                className="text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: m.titulo,
                }}
              />
            </SelectTrigger>
          ))}

          <SelectContent>
            {mensagens.map((m) => (
              <div>
                {mensagens.map((m) => (
                  <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
                    <div
                      className="prose prose-sm dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: m.mensagem }}
                    />
                  </Card>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div> */}

      {mensagens.map((m) => {
        const aberta = mensagemAberta === m.id_mensagem;

        return (
          <Card
            onClick={() =>
              setMensagemAberta((prev) =>
                prev === m.id_mensagem ? null : m.id_mensagem
              )
            }
            key={m.id_mensagem}
            className="p-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 cursor-pointer"
          >
            <div>
              <h3 className="text-md font-bold mb-2">
                <div
                  className="text-foreground leading-relaxed "
                  dangerouslySetInnerHTML={{ __html: m.titulo || "Sem título" }}
                />
              </h3>
            </div>

            {aberta && (
              <div
                className="prose prose-sm dark:prose-invert mt-2"
                dangerouslySetInnerHTML={{ __html: m.mensagem }}
              />
            )}
          </Card>
        );
      })}

      {loading && <p>Carregando mensagens...</p>}
    </div>
  );
}
