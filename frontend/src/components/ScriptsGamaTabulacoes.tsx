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
    descricao: "Ação Judicial contra o Banco GAMA",
    quandoTabular:
      "Utilizar quando cliente informar que entrou com alguma ação judicial contra o Banco GAMA, por isso solicitou a Portabilidade.",
  },
  {
    descricao: "Benefício Cancelado",
    quandoTabular:
      "Utilizar quando o cliente informar que seu benefício foi cancelado pelo INSS, pois neste caso não terá como voltar a debitar novamente de sua conta corrente, já que seu benefício foi cancelado.",
  },  
  {
    descricao: "Cliente alega ter preferência em seu Banco de origem",
    quandoTabular:
      "Utilizar quando o motivo da Portabilidade for a preferência do cliente ao seu Banco de origem, por questões de costume de utilização. Ofertar TED automática no caso de recusa.",
  },
  {
    descricao: "Cliente alega ter preferência em seu Banco de origem | Nova linha de crédito",
    quandoTabular:
      "Utilizar quando o motivo da Portabilidade for a preferência do cliente ao seu Banco de origem, e encontrar o motivo específico.",
  },
  {
    descricao: "Cliente alegou necessidade de nova linha de crédito",
    quandoTabular:
      "Utilizar quando cliente informar que saiu do Banco GAMA, pois precisava de mais uma linha de crédito/empréstimo e não obteve aprovação no GAMA.",
  },
  {
    descricao: "Cliente Falecido",
    quandoTabular:
      "Utilizar quando terceiro alegar que o cliente faleceu.",
  },
  {
    descricao: "Cliente Hospitalizado",
    quandoTabular:
      "Utilizar quando cliente ou terceiros alegar que está hospitalizado.",
  },
  {
    descricao: "Cliente não reconhece que realizou empréstimo no GAMA",
    quandoTabular:
      "Utilizar quando cliente informar que desconhece o empréstimo realizado no Banco GAMA.",
  },
  {
    descricao: "Cliente se recusa a passar informações",
    quandoTabular:
      "Utilizar para os casos em que o cliente se recusar a ouvir ou passar as informações da mudança de Banco.",
  },
  {
    descricao: "Desconhece a portabilidade do seu benefício para outro Banco",
    quandoTabular:
      "Utilizar para clientes que desconhecem que foi realizado a portabilidade de seu benefício para outro Banco, ele entende que permanece recebendo seu salário no GAMA.",
  },
  {
    descricao: "Desconhece a portabilidade do seu benefício para outro Banco | Cartão de crédito com limite maior",
    quandoTabular:
      "",
  },
  {
    descricao: "Dificuldade no processo de Prova de Vida",
    quandoTabular:
      "Utilizar quando cliente informar que solicitou a Portabilidade pois encontrou dificuldades no processo de Prova de Vida do INSS.",
  },
  {
    descricao: "Insatisfação Banco GAMA | Dificuldade de acessar os canais do GAMA",
    quandoTabular:
      "Utilizar quando cliente alegar que motivo da Portabilidade for insatisfação ou reclamação contra Banco GAMA. Ex.: Mau atendimento, falta de informações, taxas de juros, cliente se sentiu enganada.",
  },
  {
    descricao: "Portabilidade sem conhecimento pelo cliente para o Banco GAMA",
    quandoTabular:
      "Utilizar quando o cliente alegar que desconhece que foi feita a Portabilidade do seu benefício para o Banco GAMA.",
  },
  {
    descricao: "Cliente Lyra – Aceitou retorno para o GAMA",
    quandoTabular:
      "",
  },
  {
    descricao: "Cliente Lyra – Não quis retornar para o GAMA",
    quandoTabular:
      "",
  },
  {
    descricao: "Aceite – Cliente Lyra - Lojas/Receptivo",
    quandoTabular:
      "Retorno de aceites derivado do canal receptivo (Agi).",
  },
  {
    descricao: "Agente Digital – Lyra/Bancoob",
    quandoTabular:
      "",
  },
  {
    descricao: "Acordo Cobrança / Reconquista - Cliente Lyra/Bancoob",
    quandoTabular:
      "Clientes que retornaram ( ou não ) para o GAMA e fez acordo de Cobrança na célula – Clientes Agi / Bancoob.",
  },
  {
    descricao: "Enviado Oferta Refin",
    quandoTabular:
      "Clientes aptos oferta de Refin.",
  },
  {
    descricao: "Cliente Delta",
    quandoTabular:
      "Acionamento humano – Base Delta ( Aceite/Não Aceite).",
  },
  {
    descricao: "Agente Digital - Delta",
    quandoTabular:
      "Acionamento via AGV base Delta ( Aceite /Não aceite).",
  },
];

const GamaTabulacoesList = () => {
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

export default GamaTabulacoesList;