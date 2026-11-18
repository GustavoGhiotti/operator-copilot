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

import Imagem1 from "@/images/ProdutoClienteImagem1.png";
import Imagem2 from "@/images/ProdutoClienteImagem2.png";

function ScriptDelta() {
    const [abordagemOpen, setAbordagemOpen] = useState(true);
    const [segurancaOpen, setSegurancaOpen] = useState(true);
    const [argumentacaoOpen, setArgumentacaoOpen] = useState(true);
    const [falecidoOpen, setFalecidoOpen] = useState(false);
    const [leituraSelo, setLeituraSelo] = useState(true);
    const [produtosOpen, setProdutosOpen] = useState(true);
    const [produtosClienteOpen, setProdutosClienteOpen] = useState(true);
    return(
        <div className="p-6 space-y-6">
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-amber-800 text-justify hyphens-auto">
                <CardContent className="p-4">
                <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                    <h3 className="font-semibold text-red-800 dark:text-blue-400 mb-2">
                        REGRA DE ATENDIMENTO
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                        A abertura é a primeira impressão que você causa no cliente. 
                        É o momento de se apresentar e definir o tom da conversa. 
                        Por isso, é fundamental que sua introdução seja cativante, 
                        criando rapidamente uma conexão. Seja amigável, mostre interesse 
                        genuíno e deixe claro o objetivo da sua ligação ou mensagem.
                    </p>
                    </div>
                </div>
                </CardContent>
            </Card>

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
                                ☀️ Bom Dia | 🌤️ Boa Tarde | 🌙 Boa Noite!</p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                            Por favor, eu gostaria de falar com o(a) Sr.(a)
                            <Badge variant="outline" className="mx-1">
                                falar o nome do cliente
                            </Badge>
                            </p>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                            Sr.(a)_____sou o(a)
                            <Badge variant="outline" className="mx-1">
                                primeiro nome do especialista
                            </Badge>
                            falo em nome do Banco Delta. Tudo bem com o(a) senhor(a)?
                            Informo que, para sua segurança, esta ligação está sendo gravada.
                            </p>
                        </div>
                        </div>
                        
                        <div className="flex flex-col items-start gap-3 p-3 bg-gray-50 dark:bg-gray-500/10 rounded-lg border-l-4 border-gray-500">
                            <div className="flex flex-row items-start gap-3">
                                <BadgeInfo className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <h2>
                                    Cliente solicita o “código” para prosseguir com a ligação:
                                </h2>
                            </div>
                            <p className="text-sm italic text-gray-800 dark:text-gray-300">
                                Entendo sua colocação, Sr(a). <Badge variant="outline" className="mx-1">
                                    falar o nome do cliente
                                </Badge>, e gostaria de esclarecer algumas informações importantes.
                            </p>
                            <div className="grid md:grid-cols-3 gap-3">
                            <div className="p-3 bg-green-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                                <div className="flex items-center gap-2 mb-2">
                                <ThumbsDown className="h-4 w-4 text-red-600" />
                                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                                    Esclarecimento sobre práticas indevidas:
                                </span>
                                </div>
                                <p className="text-justify hyphens-auto break-words text-xs text-red-600 dark:text-red-300">
                                Essa prática relatada é frequentemente utilizada com o objetivo de confundir o cliente, 
                                especialmente ao mencionar um código de confirmação que pode dificultar o contato ou o 
                                processo desejado. Trata-se de uma conduta que não está em conformidade com as normas 
                                regulatórias e, infelizmente, é adotada por alguns correspondentes bancários de má-fé 
                                para criar obstáculos ao acesso a condições seguras e vantajosas para o cliente.
                                </p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2">
                                <Landmark className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                    Identificação do Banco atual:
                                </span>
                                </div>
                                <p className="text-justify hyphens-auto text-xs text-blue-600 dark:text-blue-300">
                                Confirmo que o banco atual do seu contrato é o Banco Delta. O Sr(a). pode ter recebido 
                                notificações relacionadas a isso por meio do aplicativo ou via SMS. É importante acompanhar 
                                essas mensagens para maior segurança.
                                </p>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-2">
                                <Check className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                    Garantia de Autorização:
                                </span>
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-300">
                                Para garantir que sou uma pessoa autorizada a falar em nome do banco, informo que tenho acesso
                                ao número do seu contrato, ao pedido de portabilidade e a outras informações relevantes. 
                                Caso deseje, posso validar esses dados para sua segurança.
                                </p>
                            </div>
                            </div>
                            <p className="text-lg italic text-gray-800 dark:text-gray-300">
                                Operador(a): Há algo mais em que eu possa ajudar neste momento? ( destacar as vantagens de permanecer no Banco )
                            </p>
                        </div>

                        {/* Abordagem */}
                        <div className="flex flex-col items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-l-4 border-purple-500">
                        <div className="flex flex-row items-start gap-3">
                            <Target className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                            <h2>
                                Abordagem:
                            </h2>
                        </div>
                        <p className="text-sm italic text-purple-800 dark:text-purple-300">
                            Motivo do meu contato é referente ao pedido de portabilidade, sempre que solicitado,
                            ligamos para entender o motivo desta troca de Banco, pois é muito importante para nós
                            compreender as suas necessidades neste momento.
                            <strong>ATENÇÃO:</strong> O cliente não deverá ser direcionado a portabilidade antes criar
                            e refinar abordagens de vendas e técnicas de negociação.
                        </p>
                        </div>

                        {/* Alerta */}
                        <div className="ml-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CircleAlert className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            ATENÇÃO:
                            </span>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border-l-4 border-red-400 ml-6">
                            <p className="text-sm text-red-700 dark:text-red-300">
                            ⚠️ O cliente não deverá ser direcionado a portabilidade antes criar e refinar abordagens de vendas e técnicas de negociação.
                            </p>
                        </div>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Segurança */}
            <Collapsible open={segurancaOpen} onOpenChange={setSegurancaOpen}>
                <Card className="border-green-200 dark:border-green-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-green-50/50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <LockIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <CardTitle className="text-lg text-green-800 dark:text-green-400">
                            Segurança:
                        </CardTitle>
                        </div>
                        {segurancaOpen ? (
                        <ChevronUp className="h-5 w-5" />
                        ) : (
                        <ChevronDown className="h-5 w-5" />
                        )}
                    </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                        <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-green-500">
                            <UserRoundCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <h2>
                                    IP Confirmação de Dados: O cliente confirma:
                                </h2>
                                <div className="text-sm italic text-gray-800 dark:text-gray-300">
                                    <li>
                                        Nome completo (Cliente fala o ultimo nome)
                                    </li>
                                    <li>
                                        Os 3 primeiros números do CPF (atendente fala os 3 primeiros números e o cliente verbaliza os dois últimos )
                                    </li>
                                    <li>
                                        Idade (cliente confirma)
                                    </li>
                                    <li>
                                        Caso cliente não confirme o CPF, passar os 09 números e pedir os dois últimos números apenas.
                                    </li>
                                    <li>
                                        Se o cliente não quiser confirmar os últimos 2 dígitos do CPF, o operador poderá solicitar o nome da mãe como dado de validação.
                                    </li>
                                </div>
                                <div className="pt-[3vh] flex flex-row gap-2">
                                    <TriangleAlert className="h-5 w-5 text-yellow-600" />ATENÇÃO: caso não tenha a confirmação de três dados, não seguir com o atendimento.
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Argumentação */}
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
                            Argumentação:
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
                        Caso cliente não tenha margem consignável disponível.
                        </p>
                        <p className="text-yellow-400">
                        ** Necessário entender qual é o motivo da portabilidade antes da oferta.
                        </p>
                         <p className="text-sm text-muted-foreground">
                        Avalie o valor para quitação do contrato no dia e
                        reforce o desconto concedido.
                        </p>
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                        Cliente com oferta de cartão de crédito:
                        </h4>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                            <p className="text-sm italic text-white-800 dark:text-white-300">
                                Sr(a) [nome] identifiquei que existe, pré aprovado, uma linha de crédito para 
                                aquisição de um cartão consignado. Este cartão é para clientes que recebem o 
                                benefício do INSS e tem taxas diferenciadas.<br/><br/>
                                Acredito que esta linha de crédito pode te ajudar neste momento, e não precisaría 
                                contratar ou renovar seu consignado. O Sr(a) continua pagando as parcelas que já 
                                esta pagando sem alterações.<br/><br/>
                                Caso o cliente aceite: Realizar a simulação no meu MB para seguir com a contratação.<br/><br/>
                                Lembrando que esta linha de crédito esta sujeita a análise no momento da contratação.<br/><br/>
                            </p>
                        </div>
                        <div className="flex flex-row pb-[2vh] gap-[1vh]">
                            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                                <div className="flex flex-row pb-[2vh] gap-[1vh] text-lg">
                                    <Paperclip className="h-4 w-4 text-orange-600 mb-2" />
                                    Perfil Mar Aberto (Meu MB)
                                </div>
                                <p className="text-sm italic text-orange-800 dark:text-orange-300">
                                    <span className="text-red-600 font-bold">Não libera o valor:</span> Utilizar argumentações conforme sondagem com o cliente.
                                </p>
                            </div>
                            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                                <div className="flex flex-row pb-[2vh] gap-[1vh] text-lg">
                                    <Paperclip className="h-4 w-4 text-orange-600 mb-2" />
                                    Perfil Rede (Plataforma)
                                </div>
                                <p className="text-sm italic text-orange-800 dark:text-orange-300">
                                    Após o cliente concordar com a contratação, realizar o IP de retenção de portabilidade.
                                </p>
                            </div>
                        </div>
                    </div>
                 
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                            Cliente com oferta de Crédito Pessoal:
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                                Sr(a) [nome] identifiquei que existe pré aprovado uma linha de crédito para contratação 
                                de um crédito pessoal. Esta oferta é específica para clientes correntistas ou que recebem 
                                seu benefício no Banco Delta.<br/><br/>
                                O valor disponível para contratação deste empréstimo é de R$XX.XXX,XX.<br/><br/>
                                Esta é uma oferta disponível para contratação hoje, e os valores podem alterar conforme 
                                disponibilidade do crédito e o momento da contratação.<br/><br/>
                                O Crédito Pessoal do Delta tem uma das melhores taxas para você que já tem relacionamento 
                                com o Banco Delta.<br/><br/>
                                <strong>Caso o cliente aceite:</strong> Realizar o processo de contratação na PLA. O cliente 
                                também pode realizar a contratação via canais de atendimento do banco.<br/><br/>
                                Após o cliente concordar com a contratação, realizar o IP de retenção de portabilidade.<br/><br/>
                                <span className="text-red-600 font-bold">Não libera o valor:</span> Utilizar argumentações conforme sondagem com o cliente.
                            </p>
                        </div>
                    </div>
                    </CardContent>

                    <CardContent className="space-y-4 pt-4">
                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-blue-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    1
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                                    Fazer perguntas abertas e direcionadas é crucial para entender melhor as necessidades do cliente e direcionar a conversa para uma solução que se ajuste a essas necessidades.
                                    </h4>
                                <div className="m-[20vh] p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-green-500">
                                    <p className="text-lg italic text-gray-800 dark:text-gray-300 text-center">
                                        Qual a necessidade do(a) senhor(a) hoje?<br/>
                                        Qual foi o valor ofertado pelo banco___?<br/>
                                        O mais te ajudaria neste momento?
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-orange-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    2
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                                    Você precisa destacar os principais benefícios do seu produto ou serviço. Esta seção deve se concentrar em como sua oferta pode resolver os problemas ou atender às necessidades do cliente. Caso não tenha oferta, deixe isso claro.
                                    </h4>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                                    <p className="text-sm italic text-gray-800 dark:text-gray-300">
                                        Taxa de juros: Hoje eu tenho uma oportunidade exclusiva para o Sr(a), consigo ajustar esse contrato na taxa de ____%. Isso vai garantir que o(a) senhor(a) não sofra nehuma alteração no seu contrato, mantendo as mesmas parcelas que já paga de R$XX,xx.<br/><br/>
                                        Consig. Pré digitação ( Ofertamos)- Empréstimo que será pago no mês de janeiro com o aumento do salario que acontece todo ano. ( categoria de nova contratação)<br/><br/>
                                        Empréstimo consignado com Seguro ou Sem seguro (Ofertamos) - empréstimo consignado INSS  podemos utilizar qual quer um dos dois, não vai mudar o valor liberado devido ter ou não o seguro.<br/><br/>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                        3
                        </div>
                        <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-orange-700 dark:text-orange-400 text-lg">
                            A proposta de valor é a parte do script onde você deve explicar claramente por que seu produto ou serviço é a melhor escolha para o cliente. Enfatize os benefícios e o valor que seu produto traz para resolver os problemas do cliente.
                        </h4>

                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                            <p className="text-sm italic text-gray-800 dark:text-gray-300">
                                Quero garantir a melhor proposta com base no seu historico do seu Banco de origem, ninguem 
                                possui seu contrato para lhe ofertar valores ou taxas reais, somente uma simução, tenho outros 
                                produtos e acredito que vá lhe ajudar neste momento.
                            </p>
                        </div>
                        </div>
                    </div>
                    <div className="text-xl flex flex-row gap-2 items-center">
                        <Speech className="h-10 w-10 text-red-600 mb-2"/>
                        Diante do que te passei, podemos manter seu contrato com o Delta?
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Falecido */}
            <Collapsible open={falecidoOpen} onOpenChange={setFalecidoOpen}>
                <Card className="border-violet-200 dark:border-violet-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-violet-50/50 dark:bg-violet-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900 rounded-lg">
                            <Ribbon className="h-5 w-5 text-violet-600" />
                        </div>
                        <CardTitle className="text-lg text-violet-800 dark:text-violet-400">
                            Confirmação de Informação de Falecimento
                        </CardTitle>
                        </div>
                        {falecidoOpen ? (
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
                            icon: "1️⃣",
                            text: "Identificação do Informante: Me informe o seu Nome Completo, e seu grau de parentesco ou relação com o(a) cliente falecido(a).",
                        },
                        {
                            icon: "2️⃣",
                            text: "Data do Falecimento: Poderia nos informar a data exata em que ocorreu o falecimento?",
                        },
                        {
                            icon: "3️⃣",
                            text: "Dados do Cliente: Para localizarmos a conta corretamente, pedimos que confirme o nome completo e o número do CPF do(a) cliente falecido(a).",
                        },
                        {
                            icon: "4️⃣",
                            text: "Documento Comprobatório: Se possível, pedimos que se dirija até uma agência com uma cópia da Certidão de Óbito do(a) cliente ou ligue no 0800... e informe o atendente sobre o Falecimento. Caso não possua a Certidão no momento, qualquer outro documento oficial que comprove o falecimento pode ser útil para iniciarmos o processo.",
                        },
                        ].map((ponto, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-3 p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-100 dark:border-violet-800"
                        >
                            <span className="text-xl flex-shrink-0">
                            {ponto.icon}
                            </span>
                            <p className="text-sm text-violet-800 dark:text-violet-300">
                            {ponto.text}
                            </p>
                        </div>
                        ))}
                    </div>

                    {/* Texto de Aprovação */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-white-700 dark:text-white-400">
                            Agradecemos a sua colaboração e lamentamos profundamente a perda. Estamos à disposição para quaisquer dúvidas ou esclarecimentos.
                        </span>
                        </div>
                        <p className="text-sm font-medium text-white-800 dark:text-white-300 bg-white/50 dark:bg-black/20 p-2 rounded">
                        Após realizar o procedimento acima o operador deve tabular: <strong className="text-orange-600">NAO RETIDO - FALECEU</strong>
                        </p>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Leitura do selo */}
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
                            Leitura do selo obrigatório:
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
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-blue-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    1
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 text-lg">
                                        Com refinanciamento (cliente aceitou a retenção COM REFIN):
                                    </h4>
                                    <p className="text-xl font-bold text-white">
                                        Tabulação: <span className="bg-gray-800 p-2 m-1 text-sm text-green-500 font-semibold rounded-full">
                                                    OPERACAO RETIDA COM RENOVACAO</span>
                                    </p>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                        Sr.(a) XXXXXX, com final de CPF xxx-xx, conforme sua aprovação, na data de hoje DD/MM/AAAA, 
                                        estamos cancelando a sua(s) solicitação(ões) de portabilidade de número(s) final(is) XXXX, 
                                        efetuada pelo [banco] XXXXXXXX, referente ao(s) contrato(s) final(is) XXXX, mediante a oferta 
                                        de refinanciamento.<br/><br/>
                                        O Sr.(a) confirma?<br /><br />
                                        <div className="bg-green-600 rounded-full w-[40vh] text-lg text-center text-white">
                                            Respostas aceitas: “SIM’’ OU ‘’CONFIRMO’’
                                        </div>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-green-500" />
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                    2
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                                        Retido sem refinanciamento (cliente aceitou a retenção sem refinanciamento):
                                    </h4>
                                    <p className="text-xl font-bold text-white">
                                        Tabulação:  <span className="bg-gray-800 p-2 m-1 text-sm text-green-500 font-semibold rounded-full">
                                                    OPERACAO RETIDA OPER.</span>
                                                    <span className="bg-gray-800 p-2 m-1 text-sm text-green-500 font-semibold rounded-full">
                                                    RETIDA COM CONTRATACAO</span>
                                    </p>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                                    <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                        Sr.(a) XXXXXX, com final de CPF xxx-xx, conforme sua aprovação, na data de hoje DD/MM/AAAA, 
                                        estamos cancelando a sua(s) solicitação(ões) de portabilidade de número(s) final(is) XXXX, 
                                        efetuada pelo [banco] XXXXXXXX, referente ao(s) contrato(s) final(is) XXXX, mantendo-o(s) 
                                        junto ao Banco Delta.<br/><br/>
                                        O Sr.(a) confirma?<br /><br />
                                        <div className="bg-green-600 rounded-full w-[40vh] text-lg text-center text-white">
                                            Respostas aceitas: “SIM’’ OU ‘’CONFIRMO’’
                                        </div>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-lg z-10">
                        3
                        </div>
                        <div className="flex-1 space-y-3">
                            <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                                Retido sem refinanciamento (portabilidade improcedente) Quando o cliente não solicitou a portabilidade:
                            </h4>
                            <p className="text-xl font-bold text-white">
                                Tabulação:  <span className="bg-gray-800 p-2 m-1 text-sm text-green-500 font-semibold rounded-full">
                                            OPERACAO RETIDA OPER.</span>
                                            <span className="bg-gray-800 p-2 m-1 text-sm text-green-500 font-semibold rounded-full">
                                            RETIDA COM CONTRATACAO</span>
                            </p>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Sr.(a) XXXXXX, com final de CPF xxx-xx, conforme sua aprovação, na data de hoje DD/MM/AAAA, 
                                estamos cancelando a sua(s) solicitação(ões) de portabilidade de número(s) final(is) XXXX, 
                                efetuada pelo [banco] XXXXXXXX sem o seu conhecimento, referente ao(s) contrato(s) final(is) 
                                XXXX, mantendo-o(s) junto ao Banco Delta.<br/><br/>
                                O Sr.(a) confirma?<br /><br />
                                <div className="bg-green-600 rounded-full w-[40vh] text-lg text-center text-white">
                                    Respostas aceitas: “SIM’’ OU ‘’CONFIRMO’’
                                </div>
                            </p>
                        </div>
                        </div>
                    </div>
                    <br />
                    <br />
                    <div className="flex-1 space-y-3">
                            <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                                Conclusão (LIBERAR SALDO):
                            </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Sr(a). [Nome do cliente], para finalizarmos o processo de portabilidade, preciso confirmar 
                                a liberação do saldo devedor do seu contrato, cuja parcela atual é de [valor da parcela], 
                                para o banco [nome do banco].<br/><br/>
                                O(a) sr(a) confirma a portabilidade?<br /><br />
                                <div className="bg-green-600 rounded-full w-[52vh] text-lg text-center text-white">
                                    Importante que o cliente responda: "Confirmo" ou "Sim"
                                </div>
                            </p>
                            <p className="text-sm mt-[3vh] text-justify italic text-gray-800 dark:text-gray-300">
                                Alguma dúvida?
                                <br/><br/>
                                <strong>Conclusão (RETIDO):</strong> Muito obrigado pelas confirmações, o seu contrato permanece no Banco Delta, tenha um ótimo dia!
                            </p>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Produtos comercializados */}
            <Collapsible open={produtosOpen} onOpenChange={setProdutosOpen}>
                <Card className="border-orange-200 dark:border-orange-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-orange-50/50 dark:bg-orange-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                            <ShoppingBag className="h-5 w-5 text-orange-600" />
                        </div>
                        <CardTitle className="text-lg text-orange-800 dark:text-orange-400">
                            Sobre os produtos comercializados:
                        </CardTitle>
                        </div>
                        {produtosOpen ? (
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
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            CREDITO PESSOAL - LISTA DE CP
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                É uma linha de crédito disponibilizada junto a instituição e que não gera consignação junto ao INSS. 
                                Ou seja, a linha de crédito não fica vinculada ao benefício do cliente e não compromete a margem para 
                                consignação. O desconto das parcelas acontece diretamente na conta do cliente.<br/><br/>
                                Hoje, o Delta conta com os seguintes produtos na linha de crédito pessoal:<br /><br />
                                <div className="ml-[3vh]">
                                    <li>Empréstimo resolve</li>
                                    <li>Antecipação do 13 salário</li>
                                    <li>Empréstimo benefício antecipado</li>
                                    <li>Empréstimo Imediato</li>
                                </div>
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            CREDITO CONSIGNADO - LISTA DE CONSIGNADO
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                É uma linha de crédito disponibilizada para contratação que gera vínculo com o benefício do cliente. 
                                Para que essa contratação aconteça, necessita de análise e aprovação do INSS. Se aprovado gera 
                                consignação ao benefício e compromete a margem do cliente. O desconto das parcelas é feito diretamente 
                                em folha. Ou seja, o desconto ocorre direto no benefício do cliente. No caso do empréstimo consignado 
                                com seguro prestamista, esse seguro é calculado junto com o valor a ser liberado ao cliente. Porém, o valor 
                                do seguro é debitado diretamente na conta do cliente, no ato da disponibilização do recurso contratado.<br/><br/>
                                <div className="ml-[3vh]">
                                    <li>Empréstimo consignado sem seguro prestamista</li>
                                    <li>Empréstimo consignado com seguro prestamista</li>
                                    <li>Consignado pré-digitação</li>
                                </div>
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            CP RESOLVE
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Produto de crédito para aposentados e pensionistas do INSS que recebem o benefício em outra Instituição Financeira;<br/><br/>
                                Consiste na liberação do empréstimo pessoal com a abertura de conta corrente e transferência do benefício para o Banco Delta;<br/><br/>
                                O desconto das parcelas ocorre mensalmente na conta corrente que foi aberta no Delta.<br/><br/>
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            CARTÃO CONSIGNADO
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Funciona como um cartão de crédito. Porém, gera consignação ao benefício do cliente. 
                                Contratando o cartão consignado, o cliente pode optar por fazer um saque de até 70% do 
                                valor total do limite do cartão. Realizando esse saque, o valor é liberado em conta em 
                                até 5 dias úteis, após a validação do INSS.<br/><br/>
                                A cobrança é feita diretamente no benefício do cliente. Porém, tem uma ressalva. 
                                Se o cliente contratar o saque e utilizar o cartão de crédito, chegará também uma fatura 
                                para pagamento referente as despesas.<br/><br/>
                                <div className="ml-[3vh]">
                                    <h2 className="-ml-[3vh]">Lista de cartões</h2>
                                    <li>Visa consignado</li>
                                    <li>Visa consignado mais</li>
                                </div>
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            13º SALÁRIO - ANTECIPAÇÃO
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                É uma linha de crédito pensada para os beneficiários do INSS, onde é disponibilizado 
                                um valor para contratação e as parcelas são pagas somente quando o INSS efetuar o pagamento 
                                do 13º salário para os beneficiários. O valor liberado não compromete todo o valor do 13º 
                                salário e o pagamento das parcelas é feito de 2x. As datas base para que os descontos 
                                aconteçam são em setembro e dezembro do ano para o qual foi feita a antecipação. 
                                Ex: se o cliente contratou a antecipação do 13º salário de 2025, os pagamentos acontecerão 
                                em setembro e dezembro de 2025. Se foi referente ao ano de 2026, os pagamento acontecerão 
                                em setembro e dezembro de 2026.<br/><br/>
                                Quando o 13º salário for pago pelo INSS ao beneficiário, o desconto das parcelas acontecerá automaticamente.<br/><br/>
                                Onde contratar?<br/><br/>
                            </p>
                            <div className="ml-[4vh] text-sm">
                                <strong>
                                    Terminais de autoatendimento<br/>
                                    Plataforma<br/>
                                    Alô Delta (0800)<br/>
                                    Portal da MEL<br/>
                                    App MB
                                </strong>
                            </div>
                        </div>
                    </div>
                    <div className="ml-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CircleAlert className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            IMPORTANTE:
                            </span>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border-l-4 border-red-400 ml-6">
                            <p className="text-sm text-red-700 dark:text-red-300">
                            ⚠️ Se houver antecipação do pagamento das parcelas do 13º salário aos beneficiários, os descontos 
                            das parcelas do empréstimo contratado, acontecerão juntamente com os pagamentos, desconsiderando as datas base. <br/><br/>
                            Ex: Se o 13º salário for pago nos meses de março e julho, as parcelas serão descontadas nesses meses e não em setembro e dezembro.
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            Caso o cliente questione sobre esses descontos
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Atendente: "Sr(a) [nome], como os descontos das parcelas do empréstimo da antecipação do 13º salário, acontecem 
                                quando o INSS efetua esse pagamento para os beneficiários, se esse pagamento é antecipado, as parcelas também 
                                são antecipadas para descontar automaticamente na data do pagamento. Por isso há esse provisionamento referente 
                                ao pagamento das parcelas."
                            </p>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Produtos */}
            <Collapsible open={produtosClienteOpen} onOpenChange={setProdutosClienteOpen}>
                <Card className="border-orange-200 dark:border-orange-800">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-orange-50/50 dark:bg-orange-950/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                            <UserPen className="h-5 w-5 text-orange-600" />
                        </div>
                        <CardTitle className="text-lg text-orange-800 dark:text-orange-400">
                            Quando o cliente contrata algum produto.
                        </CardTitle>
                        </div>
                        {produtosClienteOpen ? (
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
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Seguir com a confirmação de IP positiva. Respondida de forma correta, seguimos com o processo de contratação.<br/><br/>
                                Após concordância do cliente com a simulação, selecionar as opções conforme resposta do cliente, e relacionados as perguntas de autorização e clicar em próximo passo.<br /><br />
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            Imagem referência
                        </h4>
                        <img src={Imagem1} alt="imagem-1" />
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Na próxima tela, teremos todos os contratos referentes aos produtos que compõe 
                                a oferta de que o cliente escolheu. Temos que ler os contratos para o cliente e 
                                solicitar o segundo confirma para seguirmos com a contratação.<br/><br/>
                            </p>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Atendente: Sr.(a) (nome do cliente), vou fazer a leitura do contrato para você. 
                                Caso tenha alguma dúvida pode me interromper que esclareço.<br/><br/>
                            </p>
                        </div>
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            Imagem referência
                        </h4>
                        <img src={Imagem2} alt="imagem-2" />
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Após confirmação do cliente nos contratos, e ter flegado as opções em todos, abrirá o campo abaixo na parte de baixo dos contratos.<br/><br/>
                            </p>
                        </div>
                    </div>
                    <div className="ml-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CircleAlert className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            IMPORTANTE:
                            </span>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border-l-4 border-red-400 ml-6">
                            <p className="text-sm text-red-700 dark:text-red-300">
                            ⚠️  Nessa fase somente serão aceitos para fins de confirmação, as expressões Sim ou Confirmo. Não consideraremos OK ou pode seguir, pode fazer, etc...<br/><br/>
                            Nesse momento, enviamos para o cliente por SMS um link e um código para abertura do contrato. Por esse link, o cliente fará a leitura e assinatura do contrato.
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Atendente: Sr.(a) (nome do cliente), será enviado por SMS um link e um código para que 
                                tenha acesso ao contrato referente a sua contratação. A proposta só terá validade após a 
                                assinatura desse contrato. <br/><br/>
                                Finalizar o atendimento com o cliente através de mensagem de finalização.<br/><br/>
                                Atendente: Sr.(a) (nome do cliente), parabéns pela contratação! Agradecemos pelo contato, se precisar, conta com a gente! Tenha um ótimo dia!!!
                            </p>
                        </div>
                    </div>
                    </CardContent>
                </CollapsibleContent>
                </Card>
            </Collapsible>
        </div>
    );
}

export default ScriptDelta;