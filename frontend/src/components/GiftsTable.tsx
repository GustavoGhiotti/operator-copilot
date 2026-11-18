import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";

export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChristmasTreeModalPropsType {
  isOpen: boolean;
  onClose: () => void;
}

const ChristmasTreeModalProps: React.FC<ChristmasTreeModalPropsType> = ({
  isOpen,
  onClose,
}) => {
  const centroCusto = localStorage.getItem("centroCusto") ?? "";
  const [premios, setPremios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const atualizarEntrega = async (id: string, entregue: boolean) => {
    try {
      await axiosInstance.patch("/api/premios/entregue", {
        id,
        entregue,
      });

      // Atualiza no estado local sem recarregar
      setPremios((prev) =>
        prev.map((p) =>
          p.ID_CONSUMO === id ? { ...p, ENTREGUE: entregue } : p
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar prêmio:", error);
      alert("Erro ao atualizar status.");
    }
  };

  useEffect(() => {
    if (!isOpen || !centroCusto) return;
    setLoading(true);

    axiosInstance
      .get(`/api/premios`, {
        params: { centroCusto },
      })
      .then((res) => {
        console.log("Resposta API:", res.data);
        if (Array.isArray(res.data)) {
          setPremios(res.data);
        } else {
          setPremios([]);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar prêmios:", err);
        setPremios([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, centroCusto]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="p-0 border-none shadow-none bg-transparent flex items-center justify-center"
        style={{
          background: "transparent",
          overflow: "hidden",
          width: "100vw",
          height: "100vh",
          maxWidth: "100vw",
        }}
      >
        <div
          style={{ zIndex: 9999 }}
          className="relative mt-[5%] bg-black/40 backdrop-blur-md border border-white/20 
        rounded-xl p-6 w-[90%] h-[80%] flex flex-col gap-4 text-white overflow-y-auto"
        >
          <h2 className="text-xl font-semibold text-center">
            Lista de prêmios sorteados – {centroCusto}
          </h2>

          {loading && <p className="text-center">Carregando...</p>}

          {!loading && premios.length === 0 && (
            <p className="text-center text-white/70">
              Nenhum prêmio encontrado para este centro de custo.
            </p>
          )}

          {!loading && premios.length > 0 && (
            <table className="w-full text-left border-collapse border border-white/20">
              <thead className="bg-white/10 text-center">
                <tr>
                  <th className="p-2 border border-white/20">Operador</th>
                  <th className="p-2 border border-white/20">Prêmio</th>
                  <th className="p-2 border border-white/20">DATA/ HORA</th>
                  <th className="p-2 border border-white/20">Entregue</th>
                </tr>
              </thead>

              <tbody>
                {premios.map((item, index) => (
                  <tr key={index} className="hover:bg-white/10 transition">
                    <td className="p-2 border border-white/20">
                      {item.OPERADOR}
                    </td>
                    <td className="p-2 border border-white/20">
                      {item.PREMIO}
                    </td>
                    <td className="p-2 border border-white/20">
                      {formatDate(item.DATA_CONSUMO)}
                    </td>

                    <td className="text-center border border-white/20">
                      <input
                        type="checkbox"
                        checked={item.ENTREGUE}
                        onChange={(e) =>
                          atualizarEntrega(item.ID_CONSUMO, e.target.checked)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChristmasTreeModalProps;
