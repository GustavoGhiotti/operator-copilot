// src/pages/OperatorDashboard.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

interface OperatorDetails {
  nome: string;
  carteira: string;
  status: string;
  acordos_mes: number;
  acordos_semana: number;
  acordos_dia: number;
  valor_total: number;
  cpc_total: number;
  meta: number;
  ultima_atividade: string;
  horarios_pico: string[];
}

export default function OperatorDashboard() {
  const { nome } = useParams();
  const [data, setData] = useState<OperatorDetails | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      const res = await axios.post("http://seu-backend/operador_detalhado", {
        nome_operador: nome
      });
      setData(res.data);
    }
    fetchDetails();
  }, [nome]);

  if (!data) return <p className="p-8 text-gray-600">Carregando...</p>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">{data.nome} — {data.status}</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg bg-white shadow">
          <h2 className="font-semibold">Acordos</h2>
          <p>Mês: {data.acordos_mes}</p>
          <p>Semana: {data.acordos_semana}</p>
          <p>Hoje: {data.acordos_dia}</p>
        </div>
        <div className="p-4 border rounded-lg bg-white shadow">
          <h2 className="font-semibold">Valores</h2>
          <p>Total negociado: R$ {data.valor_total.toFixed(2)}</p>
          <p>CPCs: {data.cpc_total}</p>
          <p>Meta: R$ {data.meta.toFixed(2)}</p>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-white shadow">
        <h2 className="font-semibold">Horários de Pico</h2>
        <ul className="list-disc ml-6">
          {data.horarios_pico.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      </div>
    </div>
  );
}
