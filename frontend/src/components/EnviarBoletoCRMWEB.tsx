import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Layers3,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Parcela {
  total?: number | string;
  total_acumulado?: number | string;
}

interface EnviarBoletoModalProps {
  isOpenEnvio: boolean;
  onCloseEnvio: () => void;
  parcelas: Parcela[];
  dataPagto: string;
  periodoAte: string;
  onSelecaoChange?: (
    quantidadeParcelas: number,
    valorSelecionado: number,
  ) => void;
  onConfirmar: (quantidadeParcelas: number, valorSelecionado: number) => void;
}

const parseValor = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;

  const valor = value.trim();
  if (!valor) return 0;

  if (valor.includes(",") || valor.split(".").length > 2) {
    const parsed = Number(valor.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(valor);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

export default function EnviarBoletoModal({
  isOpenEnvio,
  onCloseEnvio,
  dataPagto,
  periodoAte,
  parcelas,
  onSelecaoChange,
  onConfirmar,
}: EnviarBoletoModalProps) {
  const totalParcelas = parcelas.length;
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(parcelas.length);

  const valorSelecionado = useMemo(() => {
    if (totalParcelas === 0) return 0;

    const parcelasSelecionadas = parcelas.slice(0, quantidadeParcelas);

    const totalSelecionado = parcelasSelecionadas.reduce(
      (total, parcela) => total + parseValor(parcela.total),
      0,
    );

    if (totalSelecionado > 0) return totalSelecionado;

    return parseValor(parcelas[quantidadeParcelas - 1]?.total_acumulado);
  }, [parcelas, quantidadeParcelas, totalParcelas]);

  useEffect(() => {
    if (!isOpenEnvio) return;

    setQuantidadeParcelas((quantidadeAtual) => {
      if (totalParcelas <= 0) return 1;
      if (quantidadeAtual > totalParcelas) return totalParcelas;

      return Math.max(1, quantidadeAtual);
    });
  }, [isOpenEnvio, totalParcelas]);

  useEffect(() => {
    if (!isOpenEnvio) return;

    onSelecaoChange?.(quantidadeParcelas, valorSelecionado);
  }, [isOpenEnvio, quantidadeParcelas, valorSelecionado, onSelecaoChange]);

  const confirmarEnvio = () => {
    if (totalParcelas === 0) return;

    onConfirmar(quantidadeParcelas, valorSelecionado);
    onCloseEnvio();
  };

  return (
    <Dialog open={isOpenEnvio} onOpenChange={(open) => !open && onCloseEnvio()}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-2xl">
        <div className="bg-gradient-to-br from-orange-500/20 via-slate-900 to-slate-950 px-6 pb-5 pt-6">
          <DialogHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-400/25">
              <FileText className="h-6 w-6" />
            </div>

            <DialogTitle className="text-2xl font-bold tracking-tight">
              Enviar boleto
            </DialogTitle>

            <p className="text-sm leading-relaxed text-slate-400">
              Escolha quantas parcelas serão incluídas no boleto. A geração
              respeita a ordem cronológica, da parcela mais antiga para a mais
              recente.
            </p>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 pb-6">
          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 text-orange-400">
                <AlertCircle className="h-5 w-5" />
              </div>

              <p className="text-sm leading-relaxed text-slate-300">
                As parcelas só podem ser geradas em um único boleto,
                priorizando sempre aquelas com maior atraso. Portanto, pagamentos
                parciais seguem a sequência das parcelas vencidas.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                <Layers3 className="h-4 w-4" />
                Disponível
              </div>

              <p className="text-xl font-bold text-slate-100">
                {totalParcelas}
              </p>

              <p className="text-xs text-slate-500">
                {totalParcelas === 1 ? "parcela" : "parcelas"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                <CheckCircle2 className="h-4 w-4" />
                Valor selecionado
              </div>

              <p className="text-2xl font-bold text-orange-400">
                {toBRL(valorSelecionado)}
              </p>

              <p className="text-xs text-slate-500">
                Total calculado para {quantidadeParcelas}{" "}
                {quantidadeParcelas === 1 ? "parcela" : "parcelas"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-orange-400">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-slate-400">Vencimento do boleto</p>
                <p className="font-semibold text-slate-100">{dataPagto} : {periodoAte}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">
                Quantidade de parcelas
              </Label>

              <Select
                value={String(quantidadeParcelas)}
                onValueChange={(value) => setQuantidadeParcelas(Number(value))}
                disabled={totalParcelas === 0}
              >
                <SelectTrigger className="h-11 border-slate-700 bg-slate-950 text-slate-100 focus:ring-orange-400">
                  <SelectValue placeholder="Selecione a quantidade" />
                </SelectTrigger>

                <SelectContent>
                  {Array.from({ length: totalParcelas }, (_, index) => {
                    const quantidade = index + 1;

                    return (
                      <SelectItem key={quantidade} value={String(quantidade)}>
                        {quantidade} parcela{quantidade > 1 ? "s" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {totalParcelas === 0 && (
                <p className="text-xs text-red-400">
                  Não existem parcelas disponíveis para emissão.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCloseEnvio}
              className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={confirmarEnvio}
              disabled={totalParcelas === 0}
              className="bg-orange-500 font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enviar boleto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}