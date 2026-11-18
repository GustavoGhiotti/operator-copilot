import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useEffect, useRef, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "sonner";
import { div } from "three/src/nodes/TSL.js";
import { X } from "lucide-react";

interface UsuarioPortal {
  nome: string;
  // email: string;
  matricula: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type MatriculaLoteItem = {
  nome: string;
  matricula: string;
};

function processarListaMatriculas(texto: string): {
    validos: MatriculaLoteItem[];
    erros: string[];
  } {
    const linhas = texto
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean);

    const validos: MatriculaLoteItem[] = [];
    const erros: string[] = [];
    const matriculasJaVistas = new Set<string>();

    linhas.forEach((linha, index) => {
      const numeroLinha = index + 1;

      const partes = linha.trim().split(/\s+/);

      if (partes.length < 2) {
        erros.push(`Linha ${numeroLinha}: formato inválido. Informe "NOME COMPLETO MATRÍCULA".`);
        return;
      }

      const matricula = partes[partes.length - 1].toUpperCase();
      const nome = partes.slice(0, -1).join(" ").trim();

      if (!nome) {
        erros.push(`Linha ${numeroLinha}: nome não informado.`);
        return;
      }

      if (!/^X[A-Z0-9]{6}$/.test(matricula)) {
        erros.push(
          `Linha ${numeroLinha}: matrícula "${matricula}" inválida. Ela deve começar com X e ter exatamente 7 caracteres.`
        );
        return;
      }

      if (matriculasJaVistas.has(matricula)) {
        erros.push(`Linha ${numeroLinha}: matrícula "${matricula}" duplicada na lista.`);
        return;
      }

      matriculasJaVistas.add(matricula);

      validos.push({
        nome,
        matricula,
      });
    });

    return { validos, erros };
  }


export const MatriculasModal = ({ isOpen, onClose }: Props) => {
  const [usuarios, setUsuarios] = useState<UsuarioPortal[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  const [multExcl, setMultExcl] = useState(false);
  const [openNovo, setOpenNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  // const [novoEmail, setNovoEmail] = useState("");
  const [excluirMatricula, setExcluirMatriculas] = useState("");
  const [novaMatricula, setNovaMatricula] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [multiplas, setMultiplas] = useState(false);
  const [cadastrarLista, setCadastrarLista] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [openEditar, setOpenEditar] = useState(false);
  const [editNome, setEditNome] = useState("");
  // const [editEmail, setEditEmail] = useState("");
  const [editMatricula, setEditMatricula] = useState("");
  const [matriculaOriginal, setMatriculaOriginal] = useState("");

  const [textoLista, setTextoLista] = useState("");
  const [errosLista, setErrosLista] = useState<string[]>([]);
  const [previewLista, setPreviewLista] = useState<{ nome: string; matricula: string }[]>([]);

  const textareaListaRef = useRef<HTMLTextAreaElement | null>(null);
  const linhasListaRef = useRef<HTMLDivElement | null>(null);

  const quantidadeLinhasLista = Math.max(textoLista.split("\n").length, 1);
  const numerosLinhasLista = Array.from(
    { length: quantidadeLinhasLista },
    (_, i) => i + 1
  );

  const handleScrollTextareaLista = () => {
    if (!textareaListaRef.current || !linhasListaRef.current) return;
    linhasListaRef.current.scrollTop = textareaListaRef.current.scrollTop;
  };

  useEffect(() => {
    if (isOpen) carregarUsuarios();
  }, [isOpen]);

  useEffect(() => {
    if (!cadastrarLista) {
      setErrosLista([]);
      setPreviewLista([]);
      return;
    }

    const { validos, erros } = processarListaMatriculas(textoLista);
    setPreviewLista(validos);
    setErrosLista(erros);
  }, [textoLista, cadastrarLista]);

  const carregarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        "/api/matriculas"
      );
      setUsuarios(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const usuariosFiltrados = usuarios.filter(
    (user) =>
      user.nome.toLowerCase().includes(busca.toLowerCase()) ||
      user.matricula.toLowerCase().includes(busca.toLowerCase())
  );

  const totalMatriculas = usuarios.length;

  const listaDeMatriculas =
    excluirMatricula.trim() !== "";

  const camposValidosNovo = 
    !cadastrarLista
      ? novoNome.trim() !== "" && /^X[A-Z0-9]{6}$/.test(novaMatricula.trim().toUpperCase())
      : textoLista.trim() !== "" && errosLista.length === 0 && previewLista.length > 0;

  const camposValidosEditar =
    editNome.trim() !== "" &&
    // editEmail.trim() !== "" &&
    editMatricula.trim() !== "";

  const handleCadastrarLista = () => {
    const proximoModoLista = !cadastrarLista;
    setCadastrarLista(proximoModoLista);

    setNovoNome("");
    setNovaMatricula("");
    setTextoLista("");
    setErrosLista([]);
    setPreviewLista([]);
  };

  const handleSalvarNova = async () => {
    try {
      setSalvando(true);

      if (!cadastrarLista) {
        await axiosInstance.post("/api/matriculas/gravar", {
          nome: novoNome.trim(),
          matricula: novaMatricula.trim().toUpperCase(),
        });

        toast.success("Matrícula cadastrada com sucesso!");

        setNovoNome("");
        setNovaMatricula("");
        setOpenNovo(false);

        await carregarUsuarios();
        return;
      }

      const { validos, erros } = processarListaMatriculas(textoLista);

      setPreviewLista(validos);
      setErrosLista(erros);

      if (erros.length > 0) {
        toast.error("Corrija os erros da lista antes de cadastrar.");
        return;
      }

      if (validos.length === 0) {
        toast.error("Nenhuma matrícula válida encontrada.");
        return;
      }

      await axiosInstance.post("/api/matriculas/gravar_lote", {
        registros: validos,
      });

      toast.success(`${validos.length} matrícula(s) cadastrada(s) com sucesso!`);

      setTextoLista("");
      setErrosLista([]);
      setPreviewLista([]);
      setCadastrarLista(false);
      setOpenNovo(false);

      await carregarUsuarios();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao cadastrar matrícula(s)");
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (user: UsuarioPortal) => {
    setEditNome(user.nome);
    // setEditEmail(user.email);
    setEditMatricula(user.matricula);
    setMatriculaOriginal(user.matricula);
    setOpenEditar(true);
  };

  const handleSalvarEdicao = async () => {
    try {
      setSalvando(true);

      await axiosInstance.put(
        `/api/matriculas/${matriculaOriginal}`,
        {
          nome: editNome,
          // email: editEmail,
          matricula: editMatricula,
        }
      );

      toast.success("Matrícula atualizada com sucesso!");

      setOpenEditar(false);
      await carregarUsuarios();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar matrícula");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    try {
      setSalvando(true);

      await axiosInstance.delete(
        `/api/matriculas/deletar/${matriculaOriginal}`
      );

      toast.success("Matrícula excluída com sucesso!");

      setConfirmOpen(false);
      setOpenEditar(false);
      await carregarUsuarios();
    } catch (error) {
      console.error("Erro ao excluir matrícula:", error);
      toast.error("Erro ao excluir matrícula");
    } finally {
      setSalvando(false);
    }
  };

  const handleMultExclusao = async () => {
    try {
      setExcluindo(true);

      // Transforma o textarea em array limpo
      const listaMatriculas = excluirMatricula
        .split("\n")
        .map((m) => m.trim())
        .filter((m) => m !== "");

      if (listaMatriculas.length === 0) {
        toast.error("Nenhuma matrícula válida informada");
        return;
      }

      await axiosInstance.delete(
        "/api/matriculas/deletar_mult",
        {
          data: {
            matriculas: listaMatriculas,
          },
        }
      );

      toast.success("Matrículas excluídas com sucesso!");

      setConfirmOpen(false);
      setExcluirMatriculas("");
      setMultExcl(false);
      await carregarUsuarios();
    } catch (error) {
      setConfirmOpen(false);
      console.error("Erro ao excluir matrículas:", error);
      toast.error("Erro ao excluir ou matrículas informadas inexistentes");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <>
      {/* MODAL PRINCIPAL */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[65vw] max-w-6xl h-[90vh] flex flex-col bg-gradient-to-br from-gray-50 via-gray-50 to-white dark:from-yellow-950/20 dark:via-yellow-950/20 dark:to-white-950/20">
          <DialogHeader className="px-6 pt-6 space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div className="flex flex-row gap-[10vh]">
                <div>
                  <DialogTitle className="text-2xl font-bold">
                    Matrículas do CRMWEB <br/>
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gerenciamento de acessos ao portal CRMWEB
                  </p>
                </div>
                <div className="flex flex-col text-center">
                  <p className="text-lg font-medium">
                    Total de Matrículas:
                  </p>
                  <p className="text-2xl text-orange-600 dark:text-yellow-400 font-medium">
                    {totalMatriculas}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 items-center">
                <div className="flex flex-row gap-4">
                  <Button
                    onClick={() => setOpenNovo(true)}
                    className="bg-orange-600 hover:bg-orange-800 text-white"
                  >
                    Nova Matrícula
                  </Button>
                  <Button
                    onClick={() => setMultExcl(true)}
                    className="bg-gray-600 hover:bg-orange-700 text-white"
                  >
                    Multipla Exclusão
                  </Button>
                </div>
                <div className="relative w-[280px]">
                  <Input
                    placeholder="Buscar por nome ou matrícula..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pr-10"
                  />

                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca("")}
                      className="
                        absolute
                        right-2
                        top-1/2
                        -translate-y-1/2
                        text-muted-foreground
                        hover:text-foreground
                        transition
                      "
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 px-6 pb-6 overflow-auto">
            {loading ? (
              <p>Carregando usuários...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    {/* <TableHead>E-mail</TableHead> */}
                    <TableHead>Matrícula</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {usuariosFiltrados.map((user, index) => (
                    <TableRow key={index}>
                      <TableCell>{user.nome}</TableCell>
                      {/* <TableCell>{user.email}</TableCell> */}
                      <TableCell>{user.matricula}</TableCell>
                      <TableCell className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirEdicao(user)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVO */}
      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{!cadastrarLista ? (<>Nova Matrícula</>):(<>Novas Matrículas</>)}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {!cadastrarLista ? (
              <div className="flex flex-col gap-5">
                <Input
                  placeholder="Nome"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                />

                <Input
                  placeholder="Matrícula"
                  value={novaMatricula}
                  onChange={(e) => {
                    const valorTratado = e.target.value.replace(/\s+/g, "").toUpperCase().slice(0, 7);
                    setNovaMatricula(valorTratado);
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex h-[20vh] w-full overflow-hidden rounded-md border bg-black/10 dark:bg-black/40">
                  <div
                    ref={linhasListaRef}
                    className="select-none overflow-hidden border-r bg-black/5 px-3 py-3 text-right text-sm text-muted-foreground dark:bg-black/20"
                  >
                    {numerosLinhasLista.map((numero) => (
                      <div key={numero} className="h-6 leading-6">
                        {numero}
                      </div>
                    ))}
                  </div>

                  <textarea
                    ref={textareaListaRef}
                    className="h-full flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-6 outline-none"
                    placeholder={`Informe uma linha por registro:`}
                    value={textoLista}
                    onChange={(e) => setTextoLista(e.target.value)}
                    onScroll={handleScrollTextareaLista}
                    spellCheck={false}
                  />
                </div>

                {errosLista.length > 0 && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 max-h-20 overflow-auto">
                    <p className="font-semibold text-red-600">Erros encontrados:</p>
                    <ul className="mt-2 space-y-1 text-sm text-red-600">
                      {errosLista.map((erro, index) => (
                        <li key={index}>{erro}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {previewLista.length > 0 && (
                  <div className="rounded-md border p-3">
                    <p className="font-semibold">Pré-visualização</p>
                    <div className="mt-2 max-h-48 overflow-auto text-sm">
                      {previewLista.map((item, index) => (
                        <div key={`${item.matricula}-${index}`} className="border-b py-2">
                          <strong>{item.nome}</strong> - {item.matricula}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleCadastrarLista}
                className="bg-gray-600 hover:bg-orange-800 text-white"
              >
                {!cadastrarLista ? (<>Lista</>):(<>Individual</>)}
              </Button>

              <Button
                onClick={handleSalvarNova}
                disabled={!camposValidosNovo || salvando}
                className="bg-orange-600 hover:bg-orange-800 text-white"
              >
                {salvando ? "Salvando..." : "Cadastrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL MULTIPLA EXCLUSÃO */}
      <Dialog open={multExcl} onOpenChange={setMultExcl}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Multipla exclusão de matrículas</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="flex gap-5">
              <textarea
                className="h-[50vh] w-full resize-none rounded-md border p-3 bg-black/10 dark:bg-black/40"
                placeholder="Informe as matrículas..."
                value={excluirMatricula}
                onChange={(e) => setExcluirMatriculas(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => (setConfirmOpen(true), setMultiplas(true))}
                disabled={!listaDeMatriculas || excluindo}
                className="bg-orange-600 hover:bg-orange-800 text-white"
              >
                {excluindo ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR */}
      <Dialog open={openEditar} onOpenChange={setOpenEditar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Matrícula</DialogTitle>
          </DialogHeader>

          <div className="font-bold flex flex-col gap-y-3 mt-4">
            <label>Nome:
              <Input
                className="font-normal"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
              />
            </label>
            {/* <label>E-mail:
              <Input
                className="font-normal"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </label> */}
            <label>Matrícula:
              <Input
                className="font-normal"
                value={editMatricula}
                onChange={(e) => setEditMatricula(e.target.value)}
              />
            </label>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSalvarEdicao}
                disabled={!camposValidosEditar || salvando}
                className="w-full bg-blue-600 hover:bg-blue-900 text-white"
              >
                {salvando ? "Salvando..." : "Salvar Alterações"}
              </Button>

              <Button
                onClick={() => (setConfirmOpen(true), setMultiplas(false))}
                disabled={salvando}
                className="w-full bg-red-600 hover:bg-red-800 text-white"
              >
                Excluir Matrícula
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {!multiplas ?
              // Excluir matrícula individual 
              (<p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir este usuário? Essa ação não poderá
                ser desfeita.
              </p>) :

              // Excluir múltiplas matrículas 
              (<p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir esta lista de usuários? Essa ação não poderá
                ser desfeita.
              </p>)
            }
            <div className="flex justify-end gap-2">
              {!multiplas ?
              // Excluir matrícula individual 
              (<Button
                onClick={handleExcluir}
                disabled={salvando}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {salvando ? "Excluindo..." : "Confirmar"}
              </Button>) :
              
              // Excluir múltiplas matrículas
              (<Button
                onClick={handleMultExclusao}
                disabled={salvando}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {salvando ? "Excluindo..." : "Confirmar"}
              </Button>)
              }
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MatriculasModal;