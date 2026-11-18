import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Phone,
  MessageSquare,
  Target,
  ChevronDown,
  ChevronUp,
  BadgeInfo,
  ThumbsDown,
  Landmark,
  Check,
  LockIcon,
  UserRoundCheck,
  TriangleAlert,
  Paperclip,
  Speech,
  Ribbon,
  BadgeCheck,
  ShoppingBag,
  UserPen,
  CircleAlert,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import Imagem1 from "@/images/ProdutoClienteImagem1.png";
import Imagem2 from "@/images/ProdutoClienteImagem2.png";

function ScriptDelta() {
    const [personaAtiva, setPersonaAtiva] = useState("demitido");
    const [abordagemOpen, setAbordagemOpen] = useState(true);
    const [segurancaOpen, setSegurancaOpen] = useState(true);
    const [argumentacaoOpen, setArgumentacaoOpen] = useState(true);
    const [falecidoOpen, setFalecidoOpen] = useState(false);
    const [leituraSelo, setLeituraSelo] = useState(true);
    const [produtosOpen, setProdutosOpen] = useState(true);
    const [produtosClienteOpen, setProdutosClienteOpen] = useState(true);
    return(
        <div className="p-6 space-y-6">
            <Tabs value={personaAtiva} onValueChange={setPersonaAtiva} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="demitido">DEMITIDO (SEM VÍNCULO)</TabsTrigger>
                    <TabsTrigger value="nunca_escriturou">NUNCA ESCRITUROU</TabsTrigger>
                    <TabsTrigger value="escrituracao_intermitente">ESCRITURAÇÃO INTERMITENTE</TabsTrigger>
                </TabsList>
            </Tabs>
            {personaAtiva === "demitido" && (
            <>
                    
            {/* DEMITIDO (SEM VÍNCULO) */}                
            {/* Abordagem Inicial */}
            <Collapsible open={abordagemOpen} onOpenChange={setAbordagemOpen}>
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
                        {abordagemOpen ? (
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
                                <h2>
                                    Apresentação:
                                </h2>
                                <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Oi
                                <Badge variant="outline" className="mx-1">
                                    primeiro nome do cliente
                                </Badge>
                                ?
                                </p>
                                <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Bom dia
                                <Badge variant="outline" className="mx-1">
                                    nome completo do cliente
                                </Badge>.<br />
                                Eu me chamo 
                                <Badge variant="outline" className="mx-1">
                                primeiro nome negociador
                                </Badge>
                                , falo da Acme Advogados e represento o Banco Delta.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                        <MessageSquare className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <h2>
                                    Abordagem Demitido
                                </h2>
                                <p className="text-sm italic text-orange-800 dark:text-orange-300">
                                    Identificamos que o senhor (a) perdeu o vínculo com a empresa que trabalhava e por isso seu empréstimo está em
                                    atraso e gerou a negativação do seu CPF no Serasa.
                                </p>
                            </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Ofertas de Negociação */}
            <Collapsible open={argumentacaoOpen} onOpenChange={setArgumentacaoOpen}>
                <Card className="border-green-200 dark:border-green-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-green-50/50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <Target className="h-5 w-5 text-green-600" />
                        </div>
                        <CardTitle className="text-lg text-green-800 dark:text-green-400">
                            Ofertas de Negociação:
                        </CardTitle>
                        </div>
                        {argumentacaoOpen ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                    <div className="flex-1 space-y-3">
                        <p>
                        1ª Oferta:
                        </p>
                        <p className="text-orange-400">
                        Trata-se de (xx) parcelas em atraso a (xx) dias. O valor atualizado é de (R$xx).
                        Posso te enviar o boleto agora mesmo em por SMS?
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg mb-2">
                            Sondagem
                            </h4>
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                <Badge variant="outline" className="mx-1 text-lg">
                                Entenda o motivo, realizando uma sondagem objetiva e direta:
                                </Badge><br /><br />

                                1- Qual proposta de pagamento se encaixa nas suas possibilidades no momento?<br /><br />
                                
                                2- Você ainda recebe seguro desemprego?
                                Caso positivo: Temos oportunidades de negociação que não comprometem a sua renda, e te dão condições de zerar
                                a sua inadimplência.<br /><br />
                                
                                3- Qual renda extra você possui? Está fazendo algum serviço informal?<br /><br />
                                <Badge variant="outline" className="mx-1 text-sm">
                                De acordo com as respostas do cliente, entenda a melhor data de recebimento de valores, e oferte a renegociação.
                                </Badge><br /><br />
                            </p>
                        </div>
                        <p>
                        2ª Oferta (SE HOUVER POP UP):
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Se você regularizar hoje todas as parcelas em atraso, uma das parcelas sairá por R$XX. Dessa forma, 
                                seu valor a pagar das parcelas sai de R$ XX para R$ XX.<br />
                                Posso te enviar o boleto agora mesmo em por SMS?
                            </p>
                        </div>
                        <p>
                        3ª Oferta (SE HOUVER POP UP):
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Consegui outra opção para você regularizar a dívida. Pagando uma única prestação em atraso com o desconto 
                                no valor de R$XX, as demais parcelas em atraso irão para o final do contrato e com isso o empréstimo vai 
                                ficar em dia e seu nome retirado do Serasa.<br />
                                Posso te enviar o boleto agora mesmo em por SMS?
                            </p><br />
                            <h2 className="text-orange-400">
                                Texto da informação subjetiva do demitido: Cliente Demitido, desconto dentro da política.
                            </h2>
                        </div>
                        <p>
                        4ª Oferta (última opção da cascata):
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Verifiquei em sistema, que conseguimos uma liberação para a renegociação do seu contrato. 
                                Nesta opção selecionamos todas as parcelas vencidas e as parcelas a vencer e realizamos um novo 
                                parcelamento. Vou te passar uma simulação:
                            </p><br />
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Entrada de R$xxxx (Mínimo 10%) + x parcelas de R$xxxxx
                                Efetuando o pagamento da entrada, ativa a renegociação e retira seu CPF da restrição. E as demais 
                                parcelas devem ser pagas mensalmente a partir do próximo mês via boleto bancário, até que você 
                                tenha um novo vínculo e o pagamento volte a ser via folha de pagamento.
                            </p><br />
                        </div>
                    </div>
                 
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Fechamento
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <h2 className="mb-2">
                                Caso o cliente aceite alguma das ofertas, o operador deve enviar e confirmar o recebimento do boleto.
                            </h2>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Você vai receber a linha digitável  referente ao nosso acordo em seu telefone via SMS, posso enviar para o telefone final xxxx?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Me confirma seu email para eu enviar o boleto também. <br />
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Se o cliente optar por receber o email:
                                </Badge>
                                Confirma o e-mail
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Ao final do contato, certifique-se de confirmar com o cliente o recebimento do SMS e do e-mail.
                                </Badge><br />
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Se não optar em receber o email: 
                                </Badge>
                                Confirmar o recebimento do SMS
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Ratificação do acordo (Selo do Negócio):
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                (NOME), a negociação da parcela X do seu Consignado, no valor de X e com vencimento em XX/XX/XXXX, 
                                foi registrada em sistema. É fundamental que o pagamento seja realizado conforme o acordado, visto 
                                que o boleto está registrado em seu CPF. O cumprimento do prazo é essencial para evitar juros, 
                                cobranças e, principalmente, a restrição do seu nome.
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Posso confirmar o seu compromisso com este pagamento?
                            </p>
                        </div>
                    </div>
                    </CardContent>
                    <div className="flex flex-col p-4 gap-2">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Perguntas e Respostas
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Como são efetuados os pagamentos das parcelas restantes?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: Como você não possui vínculo com empresa, os pagamentos precisam ser 
                                realizados por você mensalmente via boleto bancário. Assim que o sistema identificar 
                                um novo vínculo, vai encaminhar todas as informações do contrato para a empresa passar 
                                a realizar os descontos em folha de pagamento.
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Se perco o emprego, o empréstimo consignado não deveria ser suspenso até eu ter um novo?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: O empréstimo não é paralisado nessas circunstâncias. Em caso de perda de vínculo, 
                                o cliente assume a responsabilidade pelo pagamento mensal via boleto. Os descontos em folha 
                                de pagamento serão retomados assim que um novo vínculo for estabelecido.
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                O seguro do empréstimo não cobre as parcelas em caso de demissão?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
Resposta: O seguro prestamista não cobre desemprego, este seguro cobre somente morte natural
ou acidental. Portanto, o seguro não cobre as parcelas em atraso pela sua perda de vínculo com a
empresa.
                            </p>
                        </div>
                    </div>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Argumentação */}
            <Collapsible open={leituraSelo} onOpenChange={setLeituraSelo}>
                <Card className="border-orange-200 dark:border-orange-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-orange-50/50 dark:bg-orange-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                            <BadgeCheck className="h-5 w-5 text-orange-600" />
                        </div>
                        <CardTitle className="text-lg text-orange-800 dark:text-orange-400">
                            Argumentação
                        </CardTitle>
                        </div>
                        {leituraSelo ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-yellow-500 to-orange-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    ➤
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-yellow-700 dark:text-yellow-400 text-lg">
                                        Cliente alega o desemprego:
                                    </h4>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-yellow-500">
                                    <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                        Resposta:  Entendo sua situação atual, por isso o Banco disponibilizou algumas opções para renegociação do contrato. 
                                        Você regularizando ao menos uma parcela, seu CPF sairá da negativação e isso te ajudará a recolocação no mercado de trabalho.
                                        <br /><br />
                                        <div className="border border-green-400 p-1 rounded-full w-[45vh] text-lg text-center text-white">
                                            Posso te enviar o boleto com estas condições?
                                        </div>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-red-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    ➤
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 text-lg">
                                        Cliente sem interesse:
                                    </h4>                                
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                        Resposta: Permanecer com a dívida em aberto só faz com que o valor aumente devido juros e encargos e mantendo seu CPF restrito. <br />
                                        Temos algumas oportunidades, e estou aqui para te ajudar a encontrar a que melhor se encaixa em suas condições, 
                                        regularizando já conseguimos retirar seu CPF da restrição e paralisar os juros.
                                        <br /><br />
                                        <div className="border border-green-400 p-1 rounded-full w-[45vh] text-lg text-center text-white">
                                            Posso te enviar o boleto com estas condições?
                                        </div>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-lg z-10">
                            ➤
                        </div>
                        <div className="flex-1 space-y-3">
                            <h4 className="font-semibold text-red-700 dark:text-red-400 text-lg">
                                Cliente sem condições:
                            </h4>
                            <p className="text-xl font-bold text-white">
                                <span className="bg-gray-800 p-2 m-1 text-sm text-orange-500 font-semibold rounded-full">
                                Qualquer motivo: Data fora da régua de negociação, doença, acúmulo de dívidas, etc.</span>
                            </p>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Resposta: Compreendo. Justamente por esse motivo estamos com essa oferta para facilitar sua regularização.<br />
                                Esperar por uma condição melhor pode fazer o valor aumentar.<br />
                                Se pagar ao menos a entrada agora, já evita que isso aconteça e garante a retirada de seu nome da restrição com o Banco Delta.<br /><br />
                                <div className="border border-green-400 p-1 rounded-full w-[45vh] text-lg text-center text-white">
                                    Posso te enviar o boleto com estas condições?
                                </div>
                            </p>
                        </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>
            </>
            )}
            {personaAtiva === "nunca_escriturou" && (
            <>

            {/* NUNCA ESCRITUROU */}
            {/* Abordagem Inicial */}
            <Collapsible open={abordagemOpen} onOpenChange={setAbordagemOpen}>
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
                        {abordagemOpen ? (
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
                                <h2>
                                    Apresentação:
                                </h2>
                                <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Oi
                                <Badge variant="outline" className="mx-1">
                                    primeiro nome do cliente
                                </Badge>
                                ?
                                </p>
                                <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Bom dia
                                <Badge variant="outline" className="mx-1">
                                    nome completo do cliente
                                </Badge>.<br />
                                Eu me chamo 
                                <Badge variant="outline" className="mx-1">
                                primeiro nome negociador
                                </Badge>
                                , falo da Acme Advogados e represento o Banco Delta.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                        <MessageSquare className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <h2>
                                    Abordagem Nunca Escriturou
                                </h2>
                                <p className="text-sm italic text-orange-800 dark:text-orange-300">
                                    Seu contrato de empréstimo está em atraso e gerou a negativação do seu CPF no Serasa.
                                </p>
                            </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Ofertas de Negociação */}
            <Collapsible open={argumentacaoOpen} onOpenChange={setArgumentacaoOpen}>
                <Card className="border-green-200 dark:border-green-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-green-50/50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <Target className="h-5 w-5 text-green-600" />
                        </div>
                        <CardTitle className="text-lg text-green-800 dark:text-green-400">
                            Ofertas de Negociação:
                        </CardTitle>
                        </div>
                        {argumentacaoOpen ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                    <div className="flex-1 space-y-3">
                        <p>
                        1ª Oferta:
                        </p>
                        <p className="text-orange-400">
                        Trata-se de (xx) parcelas em atraso a (xx) dias. O valor atualizado é de (R$xx). Posso te enviar o boleto agora mesmo em seu E-mail e SMS?
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg mb-2">
                            Sondagem
                            </h4>
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                1- Sabe me informar o motivo do desconto não ter ocorrido em seu contracheque?<br /><br />
                                
                                2- O(A) Sr(a) chegou a conversar com a sua empresa para entender o motivo de não ter sido realizado o desconto?<br /><br />
                            </p>
                        </div>
                        <p>
                        2ª Oferta:
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Consegui para você a liberação dos juros e multas pelo atraso, o boleto será no valor original de (R$xxx). Posso emitir o boleto para aproveitar essa oportunidade?
                            </p>
                        </div>
                        <p>
                        3ª Oferta (Se houver mais de uma parcela em atraso):
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Uma alternativa é regularizar a parcela mais antiga. Isso fará com que o tempo em atraso seja atualizado e os 
                                juros sejam paralisados até que você consiga levantar os valores para quitar as demais parcelas em atraso.
                            </p><br />
                        </div>
                        <p>
                        4ª Oferta (última opção da cascata):
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Verifiquei em sistema, que conseguimos uma liberação para a renegociação do seu contrato. Nesta opção selecionamos 
                                todas as parcelas vencidas e as parcelas a vencer e realizamos um novo parcelamento. Vou te passar uma simulação:
                            </p><br />
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Entrada de R$xxxx (Mínimo 10%) + x parcelas de R$xxxxx <br />
                                Efetuando o pagamento da entrada, ativa a renegociação e retira seu CPF da restrição. E as demais parcelas devem 
                                ser pagas mensalmente a partir do próximo mês via boleto bancário, até que você tenha um novo vínculo e o pagamento 
                                volte a ser via folha de pagamento.
                            </p><br />
                        </div>
                        {/* Alerta */}
                        <div className="ml-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CircleAlert className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            Caso nenhuma das alternativas sejam aceitas, pergunte de forma segura e firme:
                            </span>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border-l-4 border-red-400 ml-6">
                            <p className="text-sm text-red-700 dark:text-red-300">
                            1- Quando o contrato foi firmado com o banco, o sr sabia das condições do contrato, valor e quantidade das parcelas. 
                            O que impede de prosseguirmos com o pagamento agora, sendo que o sr permanece trabalhando? 
                            </p><br />
                            <p className="text-sm text-red-700 dark:text-red-300">
                            2- O sr sabia que a falta de desconto em folha pode acarretar problemas para sua empresa, que estão previstos em lei? 
                            O que  acha de regularizarmos esta parcela hoje mesmo para evitar problemas entre as partes?
                            </p>
                        </div>
                        </div>
                    </div>
                 
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Fechamento
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <h2 className="mb-2">
                                Caso o cliente aceite alguma das ofertas, o operador deve enviar e confirmar o recebimento do boleto.
                            </h2>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Você vai receber a linha digitável  referente ao nosso acordo em seu telefone via SMS, posso enviar para o telefone final xxxx?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Me confirma seu email para eu enviar o boleto também. <br />
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Se o cliente optar por receber o email:
                                </Badge>
                                Confirma o e-mail
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Ao final do contato, certifique-se de confirmar com o cliente o recebimento do SMS e do e-mail.
                                </Badge><br />
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Se não optar em receber o email: 
                                </Badge>
                                Confirmar o recebimento do SMS
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Ratificação do acordo (Selo do Negócio):
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                (NOME), a negociação da parcela X do seu Consignado, no valor de X e com vencimento em XX/XX/XXXX, foi registrada em sistema. 
                                É fundamental que o pagamento seja realizado conforme o acordado, visto que o boleto está registrado em seu CPF. O cumprimento 
                                do prazo é essencial para evitar juros, cobranças e, principalmente, a restrição do seu nome. 
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Posso confirmar o seu compromisso com este pagamento?
                            </p>
                        </div>
                    </div>
                    </CardContent>
                    <div className="flex flex-col p-4 gap-2">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Perguntas e Respostas
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Como são efetuados os pagamentos das parcelas restantes?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: A regularização das parcelas em atraso devem ocorrer através do pagamento de boleto bancário, 
                                já as demais parcelas a vencer deverá ser descontada pela sua empresa em folha de pagamento e repassadas 
                                ao Banco mensalmente, porém esse processo não está ocorrendo com isso precisa verificar com a sua empresa 
                                o motivo, enquanto a sua empresa não fizer o processo corretamente, você precisará pagar via boleto.
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                É responsabilidade da empresa e não minha, vocês precisam ligar para eles.
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: A empresa possui responsabilidade no processo de desconto em folha de pagamento e repasse ao Banco, 
                                mas a responsabilidade do contrato em si e dos pagamentos são suas, pois você é o(a) titular do contrato. 
                                E quem também sofre as consequências do atraso, como a negativação do CPF por exemplo.
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Cliente não quer fechar o acordo e vai verificar com a empresa.
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: É compreensível a sua necessidade de esclarecer a situação com a empresa, e isso é um passo importante. 
                                No entanto, sua empresa só pode intervir nas próximas parcelas, realizando o desconto em folha e o repasse ao Banco. <br />
                                A regularização das parcelas em atraso é de sua responsabilidade direta. Podemos, contudo, auxiliar na busca pela 
                                melhor negociação, ajustada às suas condições atuais.
                            </p>
                        </div>
                    </div>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Argumentação */}
            <Collapsible open={leituraSelo} onOpenChange={setLeituraSelo}>
                <Card className="border-orange-200 dark:border-orange-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-orange-50/50 dark:bg-orange-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                            <BadgeCheck className="h-5 w-5 text-orange-600" />
                        </div>
                        <CardTitle className="text-lg text-orange-800 dark:text-orange-400">
                            Argumentação
                        </CardTitle>
                        </div>
                        {leituraSelo ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-red-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    ➤
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 text-lg">
                                        Cliente sem interesse:
                                    </h4>                                
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                        Resposta:  Manter a dívida em aberto resulta em um aumento constante do valor devido a juros e encargos, 
                                        além de manter seu CPF restrito. Temos opções de negociação para você! Estou aqui para ajudar a encontrar 
                                        a melhor solução que se encaixe nas suas condições. Regularizando sua situação, podemos remover a restrição 
                                        do seu CPF do Banco Delta e parar a cobrança de juros.
                                        <br /><br />
                                        <div className="border border-green-400 p-1 rounded-full w-[45vh] text-lg text-center text-white">
                                            Posso te enviar o boleto com estas condições?
                                        </div>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-lg z-10">
                            ➤
                        </div>
                        <div className="flex-1 space-y-3">
                            <h4 className="font-semibold text-red-700 dark:text-red-400 text-lg">
                                Cliente sem condições:
                            </h4>
                            <p className="text-xl font-bold text-white">
                                <span className="bg-gray-800 p-2 m-1 text-sm text-orange-500 font-semibold rounded-full">
                                Qualquer motivo: Data fora da régua de negociação, doença, acúmulo de dívidas, etc.</span>
                            </p>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Compreendo. Justamente por esse motivo estamos com essa oferta para facilitar sua regularização. <br />
                                Esperar por uma condição melhor pode fazer o valor aumentar. Se efetuar ao menos a entrada agora, 
                                já evita que isso aconteça e garante a retirada do nome da restrição.
                                <div className="border border-green-400 p-1 rounded-full w-[45vh] text-lg text-center text-white">
                                    Posso te enviar o boleto com estas condições?
                                </div>
                            </p>
                        </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>
            </>
            )}
            {personaAtiva === "escrituracao_intermitente" && (
            <>
            
            {/* ESCRITURAÇÃO INTERMITENTE */}
            {/* Abordagem Inicial */}
            <Collapsible open={abordagemOpen} onOpenChange={setAbordagemOpen}>
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
                        {abordagemOpen ? (
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
                                <h2>
                                    Apresentação:
                                </h2>
                                <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Oi
                                <Badge variant="outline" className="mx-1">
                                    primeiro nome do cliente
                                </Badge>
                                ?
                                </p>
                                <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Bom dia
                                <Badge variant="outline" className="mx-1">
                                    nome completo do cliente
                                </Badge>.<br />
                                Eu me chamo 
                                <Badge variant="outline" className="mx-1">
                                primeiro nome negociador
                                </Badge>
                                , falo da Acme Advogados e represento o Banco Delta.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                        <MessageSquare className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <h2>
                                    Abordagem Escrituração Intermitente
                                </h2>
                                <p className="text-sm italic text-orange-800 dark:text-orange-300">
                                    Verificamos que seu contrato tem pagamentos automáticos programados para débito em folha. No entanto, a(s) parcela(s) referente(s) 
                                    a [Mês] não foi(ram) repassada(s) pela empresa ao Banco.
                                    Para evitar a negativação do seu CPF no Serasa e a incidência de juros adicionais, o Banco disponibilizou a opção de pagamento avulso.
                                </p>
                            </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Ofertas de Negociação */}
            <Collapsible open={argumentacaoOpen} onOpenChange={setArgumentacaoOpen}>
                <Card className="border-green-200 dark:border-green-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-green-50/50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <Target className="h-5 w-5 text-green-600" />
                        </div>
                        <CardTitle className="text-lg text-green-800 dark:text-green-400">
                            Ofertas de Negociação:
                        </CardTitle>
                        </div>
                        {argumentacaoOpen ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                    <div className="flex-1 space-y-3">
                        <p>
                        1ª Oferta:
                        </p>
                        <p className="text-orange-400">
                        Trata-se de (xx) parcelas em atraso a (xx) dias. O valor atualizado é de (R$xx). Posso te enviar o boleto agora mesmo em seu E-mail e SMS?
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                1- Entendemos que no momento da assinatura do contrato, o senhor estava ciente das condições, incluindo valor e número de parcelas. 
                                Como o senhor continua trabalhando, gostaríamos de entender melhor o que está dificultando a continuidade dos pagamentos neste momento. 
                                Poderia nos explicar a situação?<br /><br />
                                
                                2- Sabia que regularizar o desconto em folha pode ajudar a sua empresa a cumprir as leis e evitar possíveis dores de cabeça? 
                                Que tal resolvermos essa pendência hoje mesmo para garantir a tranquilidade de todos?<br /><br />
                            </p>
                        </div>
                        <p>
                        2ª Oferta:
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Consegui para você a liberação dos juros e multas pelo atraso, o boleto será no valor original de (R$xxx). Posso emitir o boleto para aproveitar essa oportunidade?
                            </p>
                        </div>
                        <p>
                        3ª Oferta (Se houver mais de uma parcela em atraso):
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Uma alternativa é regularizar a parcela mais antiga. Isso fará com que o tempo em atraso seja atualizado 
                                e os juros sejam paralisados até que você consiga levantar os valores para quitar as demais parcelas em atraso.
                            </p><br />
                        </div>
                        <p>
                        4ª Oferta (última opção da cascata):
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Verifiquei em sistema, que conseguimos uma liberação para a renegociação do seu contrato. Nesta opção selecionamos 
                                todas as parcelas vencidas e as parcelas a vencer e realizamos um novo parcelamento. Vou te passar uma simulação:
                            </p><br />
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Entrada de R$xxxx (Mínimo 10%) + x parcelas de R$xxxxx
                                Efetuando o pagamento da entrada, ativa a renegociação e retira seu CPF da restrição. E as demais parcelas devem 
                                ser pagas mensalmente a partir do próximo mês via boleto bancário, até que você tenha um novo vínculo e o pagamento 
                                volte a ser via folha de pagamento.
                            </p><br />
                        </div>
                    </div>
                 
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Fechamento
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <h2 className="mb-2">
                                Caso o cliente aceite alguma das ofertas, o operador deve enviar e confirmar o recebimento do boleto.
                            </h2>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Você vai receber a linha digitável  referente ao nosso acordo em seu telefone via SMS, posso enviar para o telefone final xxxx?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Me confirma seu email para eu enviar o boleto também. <br />
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Se o cliente optar por receber o email:
                                </Badge>
                                Confirma o e-mail
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Ao final do contato, certifique-se de confirmar com o cliente o recebimento do SMS e do e-mail.
                                </Badge><br />
                                <Badge variant="outline" className="mx-1 text-sm mt-2">
                                Se não optar em receber o email: 
                                </Badge>
                                Confirmar o recebimento do SMS
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Ratificação do acordo (Selo do Negócio):
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                (NOME), a negociação da parcela X do seu Consignado, no valor de X e com vencimento em XX/XX/XXXX, 
                                foi registrada em sistema. É fundamental que o pagamento seja realizado conforme o acordado, visto que o 
                                boleto está registrado em seu CPF. O cumprimento do prazo é essencial para evitar juros, cobranças e, 
                                principalmente, a restrição do seu nome.
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Posso confirmar o seu compromisso com este pagamento?
                            </p>
                        </div>
                    </div>
                    </CardContent>
                    <div className="flex flex-col p-4 gap-2">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Perguntas e Respostas
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Como são efetuados os pagamentos das parcelas restantes?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: A regularização das parcelas em atraso devem ocorrer através do pagamento de boleto bancário, 
                                já as demais parcelas a vencer deverá ser descontada pela sua empresa em folha de pagamento e repassadas 
                                ao Banco mensalmente.
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Já houve o desconto em folha de pagamento, o que eu faço?
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: Entendo que os descontos vem ocorrendo em sua folha de pagamento, e já identificamos X parcelas 
                                baixadas em sistema. Porém da parcela X, não houve o repasse da sua empresa ao Banco e por isso está em atraso, 
                                e gerando a negativação do seu CPF.
                            </p><br />
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Oferta: Podemos gerar o boleto bancário para a quitação da parcela em atraso. Ressaltamos que, sendo a titular 
                                do contrato, o pagamento é de sua responsabilidade. Contudo, a senhora pode apresentar este boleto ao RH da sua 
                                empresa para que eles realizem o pagamento diretamente ou efetuem o reembolso do valor, uma vez que o desconto 
                                foi feito em seu salário, mas não foi repassado ao Banco.
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                É responsabilidade da empresa e não minha, vocês precisam ligar para eles.
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300 mb-2">
                                Resposta: A empresa possui responsabilidade no processo de desconto em folha de pagamento e repasse ao Banco, 
                                mas a responsabilidade do contrato em si e dos pagamentos são suas, pois você é o(a) titular do contrato. E quem 
                                também sofre as consequências do atraso, como a negativação do CPF por exemplo.
                            </p>
                        </div>
                    </div>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Argumentação */}
            <Collapsible open={leituraSelo} onOpenChange={setLeituraSelo}>
                <Card className="border-orange-200 dark:border-orange-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-orange-50/50 dark:bg-orange-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                            <BadgeCheck className="h-5 w-5 text-orange-600" />
                        </div>
                        <CardTitle className="text-lg text-orange-800 dark:text-orange-400">
                            Argumentação
                        </CardTitle>
                        </div>
                        {leituraSelo ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-red-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    ➤
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 text-lg">
                                        Cliente sem interesse:
                                    </h4>                                
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                        Resposta:  Manter a dívida em aberto resulta em um aumento constante do valor devido a juros e encargos, 
                                        além de manter seu CPF restrito. Temos opções de negociação para você! Estou aqui para ajudar a encontrar 
                                        a melhor solução que se encaixe nas suas condições. Regularizando sua situação, podemos remover a restrição 
                                        do seu CPF do Banco Delta e parar a cobrança de juros.
                                        <br /><br />
                                        <div className="border border-green-400 p-1 rounded-full w-[45vh] text-lg text-center text-white">
                                            Posso te enviar o boleto com estas condições?
                                        </div>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-lg z-10">
                            ➤
                        </div>
                        <div className="flex-1 space-y-3">
                            <h4 className="font-semibold text-red-700 dark:text-red-400 text-lg">
                                Cliente sem condições:
                            </h4>
                            <p className="text-xl font-bold text-white">
                                <span className="bg-gray-800 p-2 m-1 text-sm text-orange-500 font-semibold rounded-full">
                                Qualquer motivo: Data fora da régua de negociação, doença, acúmulo de dívidas, etc.</span>
                            </p>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Compreendo. Justamente por esse motivo estamos com essa oferta para facilitar sua regularização. 
                                Esperar por uma condição melhor pode fazer o valor aumentar. Se efetuar ao menos a entrada agora, 
                                já evita que isso aconteça e garante a retirada do nome da restrição.
                                <div className="border border-green-400 p-1 rounded-full w-[45vh] text-lg text-center text-white">
                                    Posso te enviar o boleto com estas condições?
                                </div>
                            </p>
                        </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>
            </>
            )}
        </div>
    );
}

export default ScriptDelta;
