import React, { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { X, CalendarDays, TrendingUp, Timer, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface EstatisticaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FrequenciaDia {
  dia: string;
  frequencia: number;
}

interface EstatisticasData {
  usuario: string;
  dias_acessados_mes: number;
  dias_acessados_semana: number;
  dias_consecutivos: number;
  primeiro_acesso: string;
  ultimo_acesso: string;
  acessos_total: number;
  dias_distintos: number;
  frequencia_por_dia_semana: FrequenciaDia[];
}

const EstatisticaModal: React.FC<EstatisticaModalProps> = ({
  isOpen,
  onClose,
}) => {
  const usuario = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();

  const [stats, setStats] = useState<EstatisticasData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEstatisticas = async () => {
    if (!usuario) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await axiosInstance.get(
        "/api/operadores/estatisticas",
        { params: { usuario } }
      );
      const data = response.data || {};
      setStats({
        usuario: String(data.usuario || usuario),
        dias_acessados_mes: Number(data.dias_acessados_mes) || 0,
        dias_acessados_semana: Number(data.dias_acessados_semana) || 0,
        dias_consecutivos: Number(data.dias_consecutivos) || 0,
        primeiro_acesso: String(data.primeiro_acesso || ""),
        ultimo_acesso: String(data.ultimo_acesso || ""),
        acessos_total: Number(data.acessos_total) || 0,
        dias_distintos: Number(data.dias_distintos) || 0,
        frequencia_por_dia_semana: Array.isArray(
          data.frequencia_por_dia_semana,
        )
          ? data.frequencia_por_dia_semana
          : [],
      });
    } catch (err: any) {
      setStats(null);
      setLoadError(
        err?.response?.data?.erro ||
          "Não foi possível carregar as estatísticas agora.",
      );
      console.error("Erro ao carregar estatísticas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadEstatisticas();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="p-6 flex items-center justify-between border-b dark:border-gray-700">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Estatísticas de Uso
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Acompanhe sua rotina dentro do sistema.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* BODY */}
        <div className="p-6">
          {isLoading && (
            <div className="flex justify-center py-10">
              <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          )}

          {!isLoading && loadError && (
            <div className="rounded-xl border border-red-300/40 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {loadError}
            </div>
          )}

          {!isLoading && stats && (
            <>
              {/* CARDS SUPERIORES */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-white">
                      Acessos no Mês
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {stats.dias_acessados_mes}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-white">
                      Acessos na Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">
                      {stats.dias_acessados_semana}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-white">
                      Dias Consecutivos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {stats.dias_consecutivos}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-white">
                      Acessos Totais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {stats.acessos_total}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* PRIMEIRO/ULTIMO ACESSO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-gray-500 text-sm">Primeiro Acesso</p>
                    <p className="text-xl font-semibold">
                      {new Date(stats.primeiro_acesso).toLocaleString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <p className="text-gray-500 text-sm">Último Acesso</p>
                    <p className="text-xl font-semibold">
                      {new Date(stats.ultimo_acesso).toLocaleString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* FREQUÊNCIA POR DIA DA SEMANA */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-primary" />
                    Frequência de Acesso por Dia da Semana
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {(stats.frequencia_por_dia_semana || []).map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                        <span>{item.dia}</span>
                        <span>{item.frequencia} acessos</span>
                      </div>
                      <Progress
                        value={
                          stats.acessos_total > 0
                            ? (item.frequencia / stats.acessos_total) * 100
                            : 0
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstatisticaModal;
