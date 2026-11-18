import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  AlertTriangle,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lightbulb,
  Target,
  Gift,
  ClipboardList,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";


function ConsignadoPrivadoDelta() {
    const [aberturaOpen, setAberturaOpen] = useState(true);
    const [cascataOpen, setCascataOpen] = useState(true);
    const [pontosOpen, setPontosOpen] = useState(true);
    return(
        <div className="p-6 space-y-6">
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-amber-800">
                <CardContent className="p-4">
                <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                    <h3 className="font-semibold text-red-800 dark:text-blue-400 mb-2">
                        Base de conhecimento
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                        O crédito <strong> CONSIGNADO PRIVADO</strong> {""} é uma
                        modalidade de empréstimo destinada a trabalhadores do
                        setor privado com carteira assinada, e pode ser contratado
                        diretamente no Banco Delta, ou por meio do aplicativo
                        CTPS digital. Este empréstimo tem desconto direto na folha
                        de pagamento do funcionário. Caso os funcionários percam o
                        vínculo empregatício, ou não possam ter desconto em folha
                        por alguma eventualidade (Afastamento pelo INSS), a
                        parcela do seu empréstimo entra em atraso, e pode
                        acarretar em uma série de consequências: Cobrança de
                        Juros, Multa e Negativação do seu CPF por exemplo. Para
                        evitar que esta situação ocorra, o Delta criou uma
                        comunicação direta com estes clientes, ofertando condições
                        especiais para regularização de sua (s) parcela (s).
                    </p>
                    </div>
                </div>
                </CardContent>
            </Card>

            {/* Alerta Importante */}
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                <CardContent className="p-4">
                <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-2">
                        ⚠️ Importante
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                        Deixe o cliente ciente de que você possui a informação de
                        que ele perdeu o vínculo empregatício. O objetivo do
                        contato será ofertar <strong>condições especiais</strong>{" "}
                        para que ele regularize sua situação com o banco e tenha
                        uma programação financeira até que seja realocado no
                        mercado de trabalho.
                    </p>
                    </div>
                </div>
                </CardContent>
            </Card>

            {/* Abordagem Inicial */}
            <Collapsible open={aberturaOpen} onOpenChange={setAberturaOpen}>
                <Card className="border-primary/20">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg">
                            Abordagem Inicial
                        </CardTitle>
                        </div>
                        {aberturaOpen ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                    {/* Saudação */}
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                        <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                            "Oi{" "}
                            <Badge variant="outline" className="mx-1">
                                Primeiro nome do cliente
                            </Badge>
                            ?"
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                            "Bom dia{" "}
                            <Badge variant="outline" className="mx-1">
                                nome completo do cliente
                            </Badge>
                            ."
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                            "Eu me chamo{" "}
                            <Badge variant="outline" className="mx-1">
                                primeiro nome do especialista
                            </Badge>
                            , sou especialista de negócios e represento o Banco
                            Delta. Por gentileza me confirme os 3 primeiros
                            números do seu CPF, tenho informações importantes
                            para lhe passar."
                            </p>
                        </div>
                        </div>

                        {/* Informação Principal */}
                        <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-l-4 border-purple-500">
                        <Target className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm italic text-purple-800 dark:text-purple-300">
                            "Estou te ligando para informar que o seu contrato de
                            Empréstimo Consignado Privado encontra-se em aberto, e
                            que o Sr.(a) não mantém vínculo com a empresa onde
                            trabalhava quando realizou a contratação.{" "}
                            <strong>
                            Atualmente você está trabalhando em outra empresa?
                            </strong>
                            "
                        </p>
                        </div>

                        {/* Resposta NÃO */}
                        <div className="ml-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            Caso informe que NÃO está trabalhando:
                            </span>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border-l-4 border-red-400 ml-6">
                            <p className="text-sm text-red-700 dark:text-red-300">
                            Oriente que assim que a Dataprev for comunicada
                            sobre o novo emprego, a empresa será orientada para
                            dar prosseguimento ao processo de escrituração e o
                            desconto em folha voltará a ocorrer mensalmente.
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-2 font-medium">
                            ⚠️ Ele precisa regularizar as parcelas em aberto
                            para evitar acúmulo de juros, multa ou negativação
                            do CPF.
                            </p>
                        </div>
                        </div>

                        {/* Verificação CRM */}
                        <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                            <ClipboardList className="h-5 w-5 text-slate-600" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Consulte no CRM se o cliente possui CPC anterior
                            </span>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                    NÃO possui CPC
                                </span>
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-300">
                                Inicie a cascata de ofertas{" "}
                                <strong>SEM descontos</strong>. Se não aceitar,
                                oferte com os descontos.
                                </p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2">
                                <Gift className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                    POSSUI CPC
                                </span>
                                </div>
                                <p className="text-xs text-blue-600 dark:text-blue-300">
                                Inicie as ofertas{" "}
                                <strong>COM os descontos</strong> desde o
                                início.
                                </p>
                            </div>
                            </div>
                        </CardContent>
                        </Card>

                        {/* Fala de Transição */}
                        <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border-l-4 border-emerald-500">
                        <MessageSquare className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm italic text-emerald-800 dark:text-emerald-300">
                            "Identificamos que seu contrato possui{" "}
                            <Badge variant="outline" className="mx-1">
                            XX
                            </Badge>{" "}
                            parcelas em atraso. Para evitar atrasos recorrentes e
                            te ajudar na regularização deste empréstimo, o
                            Delta está te concedendo um{" "}
                            <strong>desconto exclusivo</strong> para pagamento
                            imediato."
                        </p>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Cascata de Ofertas */}
            <Collapsible open={cascataOpen} onOpenChange={setCascataOpen}>
                <Card className="border-green-200 dark:border-green-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-green-50/50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <Target className="h-5 w-5 text-green-600" />
                        </div>
                        <CardTitle className="text-lg text-green-800 dark:text-green-400">
                            Cascata de Ofertas
                        </CardTitle>
                        </div>
                        {cascataOpen ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                    {/* Oferta 1 - Quitação do Contrato */}
                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-blue-500" />

                        <div className="flex gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-lg z-10">
                            1
                        </div>
                        <div className="flex-1 space-y-3">
                            <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            Quitação do Contrato
                            </h4>
                            <p className="text-sm text-muted-foreground">
                            Avalie o valor para quitação do contrato no dia e
                            reforce o desconto concedido.
                            </p>

                            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                            <MessageSquare className="h-4 w-4 text-green-600 mb-2" />
                            <p className="text-sm italic text-green-800 dark:text-green-300">
                                "Seu contrato para Quitação hoje está em{" "}
                                <Badge variant="outline">R$ XX</Badge>. Com o
                                desconto concedido pelo banco, você poderá quitar
                                por <Badge variant="outline">R$ XX</Badge>, tendo
                                um desconto de{" "}
                                <Badge variant="outline">R$ XX</Badge>.
                                <strong>
                                Para qual e-mail posso enviar o boleto?
                                </strong>
                                "
                            </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-3 mt-3">
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg border border-emerald-300 dark:border-emerald-700">
                                <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                    Cliente ACEITOU
                                </span>
                                </div>
                                <p className="text-xs text-emerald-600 dark:text-emerald-300">
                                Inclua proposta para quitação de contrato com a
                                Informação Subjetiva:
                                <strong>
                                    {" "}
                                    "Cliente demitido condição especial, política
                                    vigente."
                                </strong>
                                </p>
                            </div>
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-300 dark:border-orange-700">
                                <div className="flex items-center gap-2 mb-2">
                                <XCircle className="h-4 w-4 text-orange-600" />
                                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                                    Cliente NÃO aceitou
                                </span>
                                </div>
                                <p className="text-xs text-orange-600 dark:text-orange-300">
                                Entenda o motivo, argumente sobre o desconto. Se
                                ainda assim não aceitar, siga para a{" "}
                                <strong>regularização de parcela</strong>.
                                </p>
                            </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* Oferta 2 - Quitação de Parcelas */}
                    <div className="flex gap-4 pt-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg z-10">
                        2
                        </div>
                        <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Quitação de Parcela(s)
                        </h4>

                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <MessageSquare className="h-4 w-4 text-blue-600 mb-2" />
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                            "Compreendo sua situação no momento, mas regularizar
                            seu contrato é fundamental."
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mt-2">
                            "A parcela do seu empréstimo é{" "}
                            <Badge variant="outline">R$ XX</Badge> cada. Vejo
                            que você tem desconto especial para regularizar a(s)
                            parcela(s) em aberto pelo valor de{" "}
                            <Badge variant="outline">R$ XX</Badge>.
                            <strong>
                                Para qual e-mail posso enviar o boleto e você
                                aproveitar esta condição de pagamento?
                            </strong>
                            "
                            </p>
                        </div>

                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                Observação
                            </span>
                            </div>
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                            Oferte primeiro a regularização de{" "}
                            <strong>todas as parcelas</strong> em atraso,
                            aplique o desconto especial em apenas 1 das
                            parcelas. Caso o cliente não aceite, busque fechar o
                            acordo com o pagamento de{" "}
                            <strong>pelo menos 1 das parcelas</strong> em
                            atraso, argumentando que o desconto sobre a parcela
                            com condição especial é uma oportunidade para ele
                            ganhar um fôlego, até se realocar no mercado de
                            trabalho.
                            </p>
                        </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Pontos Importantes */}
            <Collapsible open={pontosOpen} onOpenChange={setPontosOpen}>
                <Card className="border-blue-200 dark:border-blue-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Lightbulb className="h-5 w-5 text-blue-600" />
                        </div>
                        <CardTitle className="text-lg text-blue-800 dark:text-blue-400">
                            Pontos Importantes
                        </CardTitle>
                        </div>
                        {pontosOpen ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="pt-4">
                    <div className="grid gap-3">
                        {[
                        {
                            icon: "🎯",
                            text: "Reforce que esta condição é exclusiva para este contato",
                        },
                        {
                            icon: "⏰",
                            text: "Diga que não garante que as ofertas estarão disponíveis em outro momento",
                        },
                        {
                            icon: "✅",
                            text: "Busque finalizar a ligação com pelo menos a regularização de 1 das parcelas",
                        },
                        {
                            icon: "👁️",
                            text: "Fique atento: tem clientes que possuem somente 1 parcela em atraso, e o desconto será aplicado somente para esta parcela",
                        },
                        ].map((ponto, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-800"
                        >
                            <span className="text-xl flex-shrink-0">
                            {ponto.icon}
                            </span>
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                            {ponto.text}
                            </p>
                        </div>
                        ))}
                    </div>

                    {/* Texto de Aprovação */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-700 dark:text-green-400">
                            Texto para Aprovação Mesa
                        </span>
                        </div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-300 bg-white/50 dark:bg-black/20 p-2 rounded">
                        "Aprovado conforme política de desconto ideal para
                        demitido."
                        </p>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>
        </div>
    );
}

export default ConsignadoPrivadoDelta;