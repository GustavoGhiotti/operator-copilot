import axiosInstance from "@/utils/axiosInstance";

export interface FeedbackCopilot {
  /** `false` quando a tabela ainda não foi criada no banco. */
  disponivel: boolean;
  respondido: boolean;
  nota?: number | null;
  comentario?: string | null;
}

export interface EnvioFeedbackCopilot {
  registrado: boolean;
  /** Preenchido quando `registrado` é falso. */
  motivo?: string;
}

export const copilotFeedbackApi = {
  async consultar(): Promise<FeedbackCopilot> {
    const { data } = await axiosInstance.get<FeedbackCopilot>(
      "/api/copilot/feedback",
    );
    return data;
  },

  async registrar(payload: {
    nota?: number | null;
    comentario?: string;
  }): Promise<EnvioFeedbackCopilot> {
    const { data } = await axiosInstance.post<EnvioFeedbackCopilot>(
      "/api/copilot/feedback",
      payload,
    );
    return data;
  },
};

export default copilotFeedbackApi;
