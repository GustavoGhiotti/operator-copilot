import axios from "axios";
import { useEffect } from "react";
import { div } from "three/src/nodes/TSL.js";

type TabulacaoModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const TabulacaoModal: React.FC<TabulacaoModalProps> = ({ isOpen, onClose }) => {
  const centro_custo = localStorage.getItem("centrocusto");

  useEffect(() => {
    async function mensagens() {
      if (!centro_custo) return;
      const response = await axios.get("/tabulacoes", {
        params: {
          centro_custo: centro_custo,
        },
      });
    }
    const resposta = mensagens();
  }, [open]);

  return (
    <>
      <div className=""></div>
    </>
  );
};
