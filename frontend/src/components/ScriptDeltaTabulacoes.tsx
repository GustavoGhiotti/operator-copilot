import { Tabulacao } from "./types";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

const TABULACOES: Tabulacao[] = [
  {
    descricao: "OPERACAO RETIDA",
    quandoTabular:
      "Cliente concorda com a retenção do contrato sem realizar renovação de contrato consignado ou contratação de linha de crédito.",
  },
  {
    descricao: "OPERACAO RETIDA COM RENOVACAO",
    quandoTabular:
      "Cliente concorda com a renovação do contrato intencionado.",
  },  
  {
    descricao: "OPER. RETIDA COM CONTRATACAO",
    quandoTabular:
      "Cliente concorda com a contratação de um produto no processo de retenção.",
  },
  {
    descricao: "RETIDO - NÃO SOLICITOU A PORTABILIDADE",
    quandoTabular:
      "Cliente alega não reconhecer o pedido de portabilidade.",
  },
  {
    descricao: "CLIENTE NAO SE ENCONTRA NO MOMENTO",
    quandoTabular:
      "Uma pessoa terceira atende o telefone e afirma que o cliente não esta no momento.",
  },
  {
    descricao: "TELEFONE ERRADO",
    quandoTabular:
      "Uma pessoa terceira alega que não reconhece o cliente.",
  },
  {
    descricao: "CLIENTE SOLICITOU CONTATO POSTERIOR",
    quandoTabular:
      "Cliente devidamente identificado pede contato posterior.",
  },
  {
    descricao: "LIGACAO CAIU/DESLIGOU",
    quandoTabular:
      "A ligação cai sem confirmação de que é o cliente.",
  },
  {
    descricao: "LIGACAO CAIU/DESLIGOU COM CLIENTE",
    quandoTabular:
      "Após a identificação do cliente a ligação cai por iniciativa do cliente ou por queda de ligação no sistema.",
  },
  {
    descricao: "NAO RETIDO-SEM MARGEM P/ CONTRAT./RENOV.",
    quandoTabular:
      "Cliente deseja valor de troco para renovação ou contratação de produto e não existe LPA disponível hoje.",
  },
  {
    descricao: "NAO RETIDO - INSATISFEITO COM O MB",
    quandoTabular:
      "Cliente faz reclamação direta sobre os canais de atendimento ou canais digitais do Delta e pede para realizar a portabilidade.",
  },
  {
    descricao: "NAO RETIDO - REDUCAO TAXA DE JUROS",
    quandoTabular:
      "Cliente deseja Redução de Taxa para renovação ou contratação de produto e não existe LPA disponível hoje.",
  },
  {
    descricao: "NAO RETIDO - RECUSOU-SE A CONVERSAR",
    quandoTabular:
      "Cliente não quer conversar e solicita a portabilidade do contrato.",
  },
  {
    descricao: "NAO RETIDO - RELACIONAMENTO COM OUTRA IF",
    quandoTabular:
      "Cliente tem relacionamento com outra IF (conta corrente, benefício..) e optou pela portabilidade do contrato.",
  },
  {
    descricao: "NAO RETIDO - SEM INTERESSE PROPOSTA MB",
    quandoTabular:
      "Cliente não tem interesse na oferta repassada pelo operador.",
  },
  {
    descricao: "NAO RETIDO - FALECEU",
    quandoTabular:
      "Terceiro alega que o cliente faleceu.",
  },
  {
    descricao: "NAO RETIDO - NAO CONFIRMA DADOS",
    quandoTabular:
      "Uma pessoa alega ser o cliente, porém não confirma dados.",
  },
];

const TabulacoesList = () => {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          Tabulações de Atendimento
        </h2>
        <p className="text-sm text-muted-foreground">
          Utilize a tabulação correta conforme o cenário do atendimento.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Quando Tabular?</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="text-start  hyphens-auto word-break">
          {TABULACOES.map((tab) => (
            <TableRow key={tab.descricao}>

              <TableCell>{tab.descricao}</TableCell>

              <TableCell className="text-sm text-muted-foreground">
                {tab.quandoTabular}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TabulacoesList;