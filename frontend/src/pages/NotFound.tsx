import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Ghost, ArrowLeftCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-200 via-white to-blue-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-md text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <Ghost size={64} className="text-orange-500 animate-bounce" />
        </div>
        <h1 className="text-5xl font-extrabold text-orange-600 mb-4">404</h1>
        <p className="text-gray-700 text-lg mb-6">
          Ops! Parece que você se perdeu no caminho... <br />
          A página <span className="font-mono text-red-500">{location.pathname}</span> não foi encontrada.
        </p>
        <a
          href="/home"
          className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-full hover:bg-purple-700 transition"
        >
          <ArrowLeftCircle size={20} />
          Voltar para o início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
