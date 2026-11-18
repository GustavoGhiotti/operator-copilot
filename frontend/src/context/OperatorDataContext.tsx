import React, { createContext, useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";

interface OperatorDataContextType {
  data: any[];
  loading: boolean;
  error: string | null;
}

export const OperatorDataContext = createContext<OperatorDataContextType>({
  data: [],
  loading: true,
  error: null,
});

export const OperatorDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const username = localStorage.getItem("nomeCompleto");
    if (!username) {
      setError("Nome do usuário não encontrado no localStorage.");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("userToken");
    if (!token?.trim()) {
      setError("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    axiosInstance
      .post("/api/operadores/dados", {
        nome_usuario: username,
      })
      .then((response) => {
        if (
          !response.data ||
          !response.data.dados ||
          !Array.isArray(response.data.dados)
        ) {
          setError("Erro nos dados recebidos.");
          setLoading(false);
          return;
        }

        setData(response.data.dados);
        setLoading(false);
      })
      .catch((error) => {
        setError("Acesse os comandos abaixo.");
        setLoading(false);
      });
  }, []);

  return (
    <OperatorDataContext.Provider value={{ data, loading, error }}>
      {children}
    </OperatorDataContext.Provider>
  );
};
