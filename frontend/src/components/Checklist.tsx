import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  MessageSquare,
  Target,
  UserRoundCheck,
  BookCheck,
  Ban,
  ClockAlert,
  Speech,
  Ear,
  Sun,
  Handshake,
  HandCoins,
  SmilePlus,
  ArrowRight,
  ArrowRightLeft,
  BookText,
  BookOpenCheck,
  SwatchBook,
  Coins,
  BadgeInfo,
  FileQuestionIcon,
} from "lucide-react";

function ScriptDelta() {
  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="abertura" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="abertura">Abertura</TabsTrigger>
          <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
          <TabsTrigger value="procedimento">Procedimento</TabsTrigger>
          <TabsTrigger value="finalizacao">Finalização</TabsTrigger>
        </TabsList>

        <TabsContent value="abertura" className="mt-4">
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Abertura</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                  <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />

                  <div className="space-y-2">
                    <h2>Entrei em linha em menos de 5 segundos:</h2>

                    <p className="text-sm italic text-blue-800 dark:text-blue-300">
                      Atenda a ligação com agilidade, em até 5 segundos,
                      demonstrando prontidão e respeito ao cliente.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-l-4 border-purple-500">
                  <div className="flex flex-row items-start gap-3">
                    <Target className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />

                    <h2>
                      Me apresentei corretamente e informei que a ligação é
                      gravada:
                    </h2>
                  </div>

                  <p className="text-sm italic text-purple-800 dark:text-purple-300">
                    Se apresente corretamente, identifique-se com nome do banco
                    e empresa, e informe sobre a gravação da ligação para
                    garantir transparência.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-green-500">
                <UserRoundCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Fiz a IDENTIFICAÇÃO POSITIVA corretamente &#40;data de
                    nascimento completa&#41;:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Confirme os dados do cliente com segurança, solicitando a
                    data de nascimento completa e confirmando o nome completo do
                    cliente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comunicacao" className="mt-4">
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                </div>

                <CardTitle className="text-lg">Comunicação</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                  <BookCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />

                  <div className="space-y-2">
                    <h2>Utilizou corretamente a língua portuguesa:</h2>

                    <p className="text-sm italic text-green-800 dark:text-green-300">
                      Fale de forma clara, sem erros graves e com linguagem
                      profissional.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border-l-4 border-yellow-500">
                  <div className="flex flex-row items-start gap-3">
                    <Ban className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />

                    <h2>Não interrompi o cliente de forma indelicada:</h2>
                  </div>

                  <p className="text-sm italic text-yellow-800 dark:text-yellow-300">
                    Respeite o tempo de fala do cliente, evitando interrupções
                    desnecessárias.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-orange-500">
                <ClockAlert className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Avisei o cliente em pausas &#40;principalmente &gt; 60s&#41;:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Sempre informe quando precisar colocar o cliente em espera,
                    principalmente em pausas maiores.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-purple-500">
                <Speech className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Mantive o tom de voz adequado e com clareza:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Use um tom de voz equilibrado, claro e cordial.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-blue-500">
                <Ear className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Demonstrei atenção ao cliente:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Ouça com atenção, valorize as informações e demonstre
                    interesse nas necessidades do cliente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procedimento" className="mt-4">
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                </div>

                <CardTitle className="text-lg">Procedimento</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border-l-4 border-yellow-500">
                  <Sun className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />

                  <div className="space-y-2">
                    <h2>Deixei claro o motivo do contato:</h2>

                    <p className="text-sm italic text-yellow-800 dark:text-yellow-300">
                        Explique de forma objetiva o motivo da ligação, informando valores, datas e detalhes do
                        cartão.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                  <div className="flex flex-row items-start gap-3">
                    <Handshake className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />

                    <h2>Fiz a Negociação Gradativa:</h2>
                  </div>

                  <p className="text-sm italic text-blue-800 dark:text-blue-300">
                    Oferte a data de pagamento para o dia ou para o próximo dia, além de apresentar valores
                    de forma gradativa, facilitando a aceitação do cliente.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-green-500">
                <HandCoins className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Ofertei acordo à vista ou parcelado (51+ dias de atraso):
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Para clientes com atraso a partir de 51 dias, apresente opções de negociação.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-green-500">
                <SmilePlus className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Informei as vantagens da negociação:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Destaque os benefícios e saiba contornar objeções do cliente. Exemplo: retirada de
                    restrição do CPF; paralisação de juros; fim das ligações de cobrança.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-amber-500">
                <ArrowRightLeft className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Direcionei para a CRC quando necessário:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Oriente o cliente a procurar a CRC para atualização de dados cadastrais.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finalizacao" className="mt-4">
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                </div>

                <CardTitle className="text-lg">Finalização</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                  <BookOpenCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />

                  <div className="space-y-2">
                    <h2>Confirmei os dados de contato:</h2>

                    <p className="text-sm italic text-green-800 dark:text-green-300">
                        Valide o endereço (exemplo: rua, bairro, número, cidade e estado) e busque contatos
                        adicionais de forma positiva. Confirme o e-mail e o número de telefone e questione se o
                        cliente possui mais alguma informação para contato.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-l-4 border-purple-500">
                  <div className="flex flex-row items-start gap-3">
                    <SwatchBook className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />

                    <h2>Fiz o selo do negócio e ratifiquei o acordo:</h2>
                  </div>

                  <p className="text-sm italic text-purple-800 dark:text-purple-300">
                    Reforce todos os detalhes do acordo: valores, datas, forma de pagamento e parcelas.
                    Confirme com o cliente se ele realmente tem certeza do pagamento, evitando que o acordo
                    seja quebrado.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-amber-500">
                <Coins className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Informei as consequências do não pagamento:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Explique de forma clara o que pode acontecer caso o acordo não seja cumprido. Exemplo:
                    manutenção ou inclusão de restrição no CPF, continuidade da cobrança, incidência de
                    juros.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/10 rounded-lg border-l-4 border-amber-500">
                <FileQuestionIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />

                <div className="space-y-2">
                  <h1 className="text-sm italic text-gray-800 dark:text-gray-300">
                    Verifiquei dúvidas e encerrei cordialmente:
                  </h1>

                  <p className="text-sm italic text-gray-800 dark:text-gray-300">
                    Pergunte se há dúvidas e finalize com educação, garantindo uma boa experiência.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ScriptDelta;