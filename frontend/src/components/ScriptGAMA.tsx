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
  AlertCircle,
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
    const [falecidoOpen, setFalecidoOpen] = useState(true);
    const [leituraSelo, setLeituraSelo] = useState(true);
    const [produtosOpen, setProdutosOpen] = useState(true);
    const [produtosClienteOpen, setProdutosClienteOpen] = useState(true);
    return(
        <div className="p-6 space-y-6">
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
                                Saudação e identificação:
                            </h2>
                            <p className="text-sm italic text-blue-800 dark:text-blue-300">
                            Olá, muito ☀️ Bom Dia | 🌤️ Boa Tarde | 🌙 Boa Noite! Estou falando com o Senhor (a). 
                            <Badge variant="outline" className="mx-1">
                                falar o nome do cliente
                            </Badge>,
                            tudo bem com o senhor(a)? Meu nome é 
                            <Badge variant="outline" className="mx-1">
                                primeiro nome do especialista
                            </Badge>, 
                            falo em nome do Banco GAMA.
                            </p>
                        </div>
                        </div>
                        {/* Abordagem */}
                        <div className="flex flex-col items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-l-4 border-purple-500">
                        <div className="flex flex-row items-start gap-3">
                            <Target className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                            <h2>
                                Contextualização:
                            </h2>
                        </div>
                        <li className="text-sm italic text-purple-800 dark:text-purple-300 ml-5">
                            Qual banco que o senhor (a) atualmente recebe seu benefício?
                        </li>
                        <p className="text-sm italic text-purple-800 dark:text-purple-300">
                            Caso o cliente responda que recebe do GAMA, seguimos falando dos
                            benefícios de ser cliente GAMA (item 5) e se o cliente quer continuar
                            recebendo com a gente (seguir o item 7)
                        </p>
                        <li className="text-sm italic text-purple-800 dark:text-purple-300 ml-5">
                            Recebemos a informação de que o senhor(a) transferiu o benefício para outro banco, 
                            e gostaríamos de conversar sobre isso para ver como podemos te ajudar a trazer seu 
                            benefício de volta para o Banco GAMA.
                        </li>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-green-500">
                        <UserRoundCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                            <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                                Validação de segurança:
                            </h1>
                            <p className="text-sm italic text-gray-800 dark:text-gray-300">
                                Antes de seguir, informo que esta ligação está sendo gravada. Para sua segurança, 
                                poderia confirmar seu nome completo e os três primeiros ou dois últimos dígitos do CPF?
                            </p>
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
                            Sondagem:
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
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                            <div className="mx-[4vh]">
                                <li>Por qual motivo o senhor(a) mudou de banco?</li>
                                <p className="mx-[2vh]">Ouvir atentamente e argumentar conforme o relato e, caso o cliente não responda, fazer a seguinte sondagem:</p><br />
                                <li>O outro banco chegou a oferecer alguma condição especial que chamou sua atenção?</li>
                            </div>
                        </div>
                    </div>
                    <div className="text-xl flex flex-row gap-2 items-center">
                        <AlertCircle className="h-10 w-10 text-yellow-400 mb-2"/>
                        Tabular as informações conforme descritas pelo cliente
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
                            Apresentação dos benefícios + clareza sobre portabilidade:
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
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5 bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3 mb-[8vh]">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        Senhor (a) [Nome do Cliente], o Banco GAMA está há mais de 90 anos no mercado, 
                                        sempre oferecendo soluções financeiras seguras e práticas para aposentados e pensionistas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5  bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3 mb-[8vh]">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        O(a) Senhor(a) é um cliente muito importante para nós, e por isso, gostaríamos de oferecer 
                                        vantagens exclusivas para que volte a receber seu benefício INSS conosco. Vou falar sobre 
                                        algumas das vantagens que preparamos. Ok?
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5 bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3 mb-[8vh]">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        Se o Senhor (a) precisar de dinheiro antes da data de pagamento, no GAMA é possível 
                                        fazer a antecipação do valor do seu benefício de forma rápida e segura através das 
                                        nossas lojas Help! e agências GAMA.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5 bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3 mb-[8vh]">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        Outra vantagem é que, após o pagamento de 4 parcelas em dia por débito em conta, 
                                        o senhor(a) pode ter a possibilidade de uma oferta de refinanciamento. Essa oferta permite 
                                        o senhor (a) reorganizar seu contrato, liberando um valor extra para o seu orçamento.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5 bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3 mb-[8vh]">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        Com o GAMA também, o saque do seu benefício é muito mais fácil e está disponível 24 horas 
                                        por dia, através dos mais de 23 mil caixas eletrônicos da rede Banco 24 Horas. Com isso, 
                                        o senhor (a) garante o acesso ao seu dinheiro quando e onde precisar, sem depender de 
                                        horário bancário.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5 bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3 mb-[8vh]">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        No GAMA fazemos a prova de vida sem complicação! O senhor(a) pode fazer sua prova 
                                        de vida em quase mil lojas Help! espalhadas pelo Brasil, em qualquer agência GAMA ou 
                                        até mesmo via biometria. É rápido, prático e perto de você.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5 bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3 mb-[8vh]">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        Recebendo seu benefício no GAMA, o senhor (a) tem a segurança de realizar a consulta 
                                        de saldo, fazer transferências e pagamentos, entre diversos outros serviços, sem sair 
                                        de casa: pelo App GAMA ou através da nossa Central de Atendimento.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute left-6 top-2 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-500" />
                            <div className="flex gap-6">
                                <div className="relative top-6 flex-shrink-0 left-4 w-5 h-5 bg-orange-500 text-white flex items-center justify-center font-bold text-lg z-10">
                                </div>
                                <div className="flex-1 space-y-3">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-orange-500">
                                    <p className="text-lg text-justify italic text-gray-800 dark:text-gray-300">
                                        Além de todas essas vantagens, recebendo o seu benefício no GAMA o senhor tem a 
                                        possibilidade de ter a oferta de 3 linhas de crédito, sendo elas:
                                    </p>
                                    <div className="mx-[5vh]">
                                        <li>Empréstimo consignado;</li>
                                        <li>Empréstimo com débito em conta corrente;</li>
                                        <li>Cartão consignado;</li>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <br />
                    <br />
                    <div className="grid grid-cols-[12rem_auto_4rem] gap-10 text-left">
                        <div>
                            <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                                Conversão:
                            </h4>
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                                <p className="text-sm italic break-words hyphens-auto text-left text-gray-800 dark:text-gray-300">
                                O que o senhor(a) achou dessas vantagens? Podemos registrar seu interesse em trazer
                                seu benefício de volta para o Banco GAMA?
                                </p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                                Aceite (deve ser claro e objetivo):
                            </h4>
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                                <div className="mx-[3vh] text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                    <li>Faremos a portabilidade do seu benefício para sua conta do Banco GAMA, garantindo que o senhor(a) volte a receber conosco com toda praticidade e segurança</li>
                                    <li>Senhor (a) [Nome do Cliente], hoje [Data] às [Hora], o senhor(a) confirma que está ciente e concorda com o retorno do recebimento do seu benefício para o Banco GAMA?”</li>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="ml-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CircleAlert className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            (Aceite válido apenas se cliente responder: SIM, ACEITO, CONCORDO, AUTORIZO.)
                            </span>
                        </div>
                        <div className="p-5 bg-red-50 dark:bg-red-950/30 rounded-lg border-l-4 border-red-400">
                            <p className="text-sm text-red-700 dark:text-red-300">
                            ⚠️ O cliente deve ter 100% de ciência que voltará a receber o benefício pelo Banco
                            GAMA. Não informar prazo ou garantia de liberação de crédito.
                            </p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            ACEITE CLIENTE QUE DIZ QUE RECEBE NO GAMA
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <div className="mx-[3vh] text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                <li>Senhor (a) [Nome do Cliente], hoje [Data] às [Hora], o senhor(a) confirma que
                                    está ciente e concorda em continuar o recebimento do seu benefício no
                                    Banco GAMA?”</li>
                                <li>(Aceite válido apenas se cliente responder: SIM, ACEITO, CONCORDO,
                                    AUTORIZO.)</li>
                            </div>
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
                            Orientações finais:
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
                            Caso aceite
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                O Sr. (a) tem alguma dúvida a respeito do retorno do pagamento do seu benefício ao Banco GAMA?<br/><br/>
                                O Banco GAMA dará sequência ao processo de portabilidade do seu benefício para a conta GAMA. 
                                Para qualquer dúvida, entre em contato com a Central: 0800 770 1790 / 4002-7007.
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            Caso o cliente pergunte sobre benefícios
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Após o primeiro recebimento do benefício no GAMA, basta ligar na Central de atendimento 
                                ou se encaminhar até uma loja Help! ou agências do GAMA, para verificar a possibilidade 
                                da liberação dos benefícios.
                            </p><br />
                            <h2 className="text-xl text-center">
                                Caso não aceite – OFERTA DE TED DO BENEFÍCIO
                            </h2>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Senhor (a) [Nome do Cliente], sabia que existe a possibilidade de aproveitar todos os 
                                benefícios do Banco GAMA e ainda continuar movimentando sua conta no banco que preferir?
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Ao aceitar trazer seu benefício, faremos a portabilidade para uma conta GAMA e, após 
                                descontar o valor das suas parcelas em aberto (caso existam), realizaremos uma TED 
                                automática para o banco que o senhor(a) indicar, com o valor do saldo residual do 
                                seu benefício. Assim, o(a) senhor(a) pode aproveitar todas as vantagens que preparamos 
                                no GAMA e qualquer outra vantagem que tenha no outro banco que tem relacionamento.
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                E o que é esse saldo residual?<br/><br/>
                                É muito simples: valor do benefício recebido no GAMA menos as parcelas em aberto (se houver). 
                                Exemplo: benefício de R$ 2.000,00 e parcela de R$ 200,00 → saldo residual de R$ 1.800,00 
                                será transferido automaticamente para sua conta de preferência.
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                O Senhor (a) aceita a realização da portabilidade do pagamento do seu benefício para a sua 
                                conta no GAMA e o cadastramento da TED automática?
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            Caso aceite
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Senhor (a) [Nome do Cliente], hoje [Data] às [Hora], o senhor(a) confirma que está 
                                ciente e concorda com o retorno do recebimento do seu benefício para o Banco GAMA e o 
                                cadastramento da TED automática?<br/><br/>
                                <span className="bg-green-600 px-2 text-lg rounded-none text-white">(Aceite válido apenas se cliente responder: SIM, ACEITO, CONCORDO, AUTORIZO.) </span>
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Por favor, preciso das informações do banco, agência e conta para cadastrar a TED automática.
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                O Sr. (a) tem alguma dúvida a respeito do retorno do pagamento do seu benefício ao Banco GAMA?
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                O Banco GAMA dará sequência ao processo de portabilidade do seu benefício para a conta GAMA. 
                                Para qualquer dúvida, entre em contato com a Central: 0800 770 1790 / 4002-7007.
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-red-700 dark:text-red-400 text-lg">
                            Caso não aceite – OFERTA DE BÔNUS R$20
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Entendo, senhor(a) [Nome do Cliente]. Antes de encerrarmos, eu tenho aqui
                                uma condição especial para te oferecer!
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Se o senhor(a) trazer novamente o recebimento do seu benefício para o
                                Banco GAMA, disponibilizaremos um bônus exclusivo de R$20, que será
                                creditado diretamente na sua conta GAMA.
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Esse valor será pago no próximo mês, após o banco confirmar que o seu
                                benefício voltou a ser depositado aqui no GAMA. Essa é uma forma de
                                reconhecer a sua escolha e agradecer por continuar sendo nosso cliente.
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                O senhor(a) gostaria de aproveitar essa condição especial e trazer o
                                benefício de volta para o GAMA?
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-lg">
                            Caso Aceite
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Senhor (a) [Nome do Cliente], hoje [Data] às [Hora], o senhor(a) confirma que
                                está ciente e concorda com o retorno do recebimento do seu benefício para o
                                Banco GAMA?
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                (Aceite válido apenas se cliente responder: SIM, ACEITO, CONCORDO,
                                AUTORIZO.)
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-red-700 dark:text-red-400 text-lg">
                            Caso não aceite
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Entendo, senhor(a) [Nome do cliente]. Apenas para relembrá-lo(a), seu empréstimo com o GAMA 
                                e a Help! continuarão abertos e seu atraso poderá incorrer na cobrança de juros e multa, 
                                além de uma possível negativação.
                            </p><br/>
                            <p className="text-sm text-justify italic text-gray-800 dark:text-gray-300">
                                Agradeço sua atenção em nome do Banco GAMA. Qualquer dúvida, estamos à disposição nos números informados.
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