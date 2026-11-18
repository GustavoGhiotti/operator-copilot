export type StatusConversa = "ABERTA" | "EM_ATENDIMENTO" | "ENCERRADA";

export type DirecaoMensagem = "RECEBIDA" | "ENVIADA";

export type SlaStatus = "OK" | "ATENCAO" | "CRITICO";

export interface DashboardMetricas {
  totalAbertas: number;
  emAtendimento: number;
  foraSLA: number;
  operadoresAtivos: number;
}

export interface Conversa {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  numeroEmpresa?: string;
  numero_empresa?: string;
  status: StatusConversa;
  operadorNome?: string;
  foraSLA: boolean;
  slaStatus?: SlaStatus;
  ultimaMensagem?: string;
  direcaoUltimaMensagem?: DirecaoMensagem;
  ultimaMensagemEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  naoLidas?: number;
}

export interface Mensagem {
  id: string | number;
  conversaId: string | number;
  conteudo: string;
  direcao: DirecaoMensagem;
  operadorNome?: string;
  criadoEm: string;
}

export interface EventoMonitoria {
  id: string;
  event: string;
  data: {
    tipo: string;
    payload: unknown;
  };
}
