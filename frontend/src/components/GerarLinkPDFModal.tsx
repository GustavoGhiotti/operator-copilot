import { useEffect, useRef, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GerarLinkPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LinkGerado {
  label: string;
  arquivo: string;
  link: string;
}

const GERAR_LINK_PDF_ROUTE = "/api/digital/gerar-link-pdf";

const extractReturnedLink = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";

  const data = payload as Record<string, unknown>;

  if (typeof data.link === "string") return data.link;
  if (typeof data.url === "string") return data.url;

  const nestedData = data.data;
  if (nestedData && typeof nestedData === "object") {
    const nested = nestedData as Record<string, unknown>;
    if (typeof nested.link === "string") return nested.link;
    if (typeof nested.url === "string") return nested.url;
  }

  return "";
};

export default function GerarLinkPDFModal({
  isOpen,
  onClose,
}: GerarLinkPDFModalProps) {
  const { toast } = useToast();
  const arquivoInputRef = useRef<HTMLInputElement>(null);
  const copiarTodosRef = useRef<HTMLTextAreaElement>(null);
  const linkInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [arquivos, setArquivos] = useState<File[]>([]);
  const [idCliente, setIdCliente] = useState("");
  const [loading, setLoading] = useState(false);
  const [linksRetornados, setLinksRetornados] = useState<LinkGerado[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setArquivos([]);
    setIdCliente("");
    setLinksRetornados([]);
    setLoading(false);
    linkInputRefs.current = {};
  }, [isOpen]);

  const handleLimpar = () => {
    setArquivos([]);
    setIdCliente("");
    setLinksRetornados([]);

    if (arquivoInputRef.current) {
      arquivoInputRef.current.value = "";
    }

    linkInputRefs.current = {};
  };

  const copiarViaExecCommand = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (!element) return false;

    element.focus();
    element.select();

    if ("setSelectionRange" in element) {
      element.setSelectionRange(0, element.value.length);
    }

    return document.execCommand("copy");
  };

  const copiarTextoTemporario = (texto: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = texto;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "8px";
    textArea.style.left = "8px";
    textArea.style.width = "1px";
    textArea.style.height = "1px";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);

    const copiado = copiarViaExecCommand(textArea);

    document.body.removeChild(textArea);
    return copiado;
  };

  const copiarTexto = async (
    texto: string,
    descricao: string,
    inputKey?: string
  ) => {
    try {
      if (!texto?.trim()) {
        throw new Error("Nenhum link disponível para copiar.");
      }

      let copiado = false;

      const podeUsarClipboardApi =
        window.isSecureContext && !!navigator.clipboard?.writeText;

      if (podeUsarClipboardApi) {
        await navigator.clipboard.writeText(texto);
        copiado = true;
      } else if (inputKey) {
        copiado = copiarViaExecCommand(linkInputRefs.current[inputKey] ?? null);
      } else if (copiarTodosRef.current) {
        copiarTodosRef.current.value = texto;
        copiado = copiarViaExecCommand(copiarTodosRef.current);
      } else {
        copiado = copiarTextoTemporario(texto);
      }

      if (!copiado) {
        throw new Error("Falha ao copiar.");
      }

      toast({
        title: "Copiado",
        description: descricao,
      });
    } catch (error) {
      console.error("Erro ao copiar link:", error);
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const handleGerarLink = async () => {
    if (!idCliente.trim()) {
      toast({
        title: "ID do cliente obrigatório",
        description: "Informe o idCliente para gerar o link do PDF.",
        variant: "destructive",
      });
      return;
    }

    if (!arquivos.length) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione um ou mais arquivos PDF para gerar os links.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setLinksRetornados([]);

    try {
      const linksGerados: LinkGerado[] = [];

      for (const [index, arquivo] of arquivos.entries()) {
        const formData = new FormData();
        formData.append("arquivo", arquivo);
        formData.append("idCliente", idCliente.trim());

        const response = await axiosInstance.post(GERAR_LINK_PDF_ROUTE, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000,
        });

        const link = extractReturnedLink(response.data);

        if (!link) {
          throw new Error(`Link não retornado para o arquivo ${arquivo.name}.`);
        }

        linksGerados.push({
          label: `Link ${index + 1}`,
          arquivo: arquivo.name,
          link,
        });

        setLinksRetornados([...linksGerados]);
      }

      toast({
        title: linksGerados.length === 1 ? "Link gerado" : "Links gerados",
        description:
          linksGerados.length === 1
            ? "O link do PDF foi retornado com sucesso."
            : "Os links dos PDFs foram retornados com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao gerar link do PDF:", error);
      setLinksRetornados([]);

      toast({
        title: "Erro",
        description: "Não foi possível gerar os links dos PDFs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const todosOsLinks = linksRetornados.map(({ link }) => link).join("\n");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Gerar Link de PDF
          </DialogTitle>
        </DialogHeader>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>ID do cliente</Label>
              <Input
                type="text"
                value={idCliente}
                onChange={(e) => setIdCliente(e.target.value.replace(/\D/g, ""))}
                placeholder="Informe o idCliente"
              />
            </div>

            <div className="space-y-2">
              <Label>Arquivos PDF</Label>
              <Input
                ref={arquivoInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files ?? []);
                  setArquivos(selectedFiles);
                  setLinksRetornados([]);
                }}
              />
              {arquivos.length > 0 && (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  {arquivos.map((arquivo, index) => (
                    <div key={`${arquivo.name}-${arquivo.lastModified}`}>
                      PDF {index + 1}: {arquivo.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLimpar}
                disabled={loading || (!arquivos.length && !idCliente && !linksRetornados.length)}
              >
                Limpar
              </Button>
              <Button
                onClick={handleGerarLink}
                disabled={loading || !arquivos.length || !idCliente.trim()}
              >
                {loading ? "Gerando..." : arquivos.length > 1 ? "Gerar links" : "Gerar link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <textarea
              ref={copiarTodosRef}
              readOnly
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none absolute opacity-0"
            />

            <div className="flex items-center justify-between gap-3">
              <Label>Retorno da rota</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copiarTexto(todosOsLinks, "Todos os links foram copiados.")
                }
                disabled={!linksRetornados.length}
              >
                Copiar todos
              </Button>
            </div>

            {linksRetornados.length > 0 ? (
              <div className="space-y-3">
                {linksRetornados.map(({ label, arquivo, link }, index) => {
                  const inputKey = `${label}-${index}`;

                  return (
                    <div key={`${label}-${arquivo}`} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>{label}</Label>
                        <span className="truncate text-xs text-muted-foreground">
                          {arquivo}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Input
                          ref={(el) => {
                            linkInputRefs.current[inputKey] = el;
                          }}
                          value={link}
                          readOnly
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            copiarTexto(link, `${label} copiado.`, inputKey)
                          }
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Input readOnly placeholder="Os links aparecerão aqui" />
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}