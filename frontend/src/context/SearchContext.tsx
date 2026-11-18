import { createContext, useState, ReactNode } from "react";
import axios from "axios";

interface SearchContextType {
  isSearching: boolean;
  customer: any;
  customerData: any;
  error: string | null;
  handleSearch: (term: string) => Promise<void>;
  setCustomer: React.Dispatch<React.SetStateAction<any>>;
  setCustomerData: React.Dispatch<React.SetStateAction<any>>;
}

export const SearchContext = createContext<SearchContextType | null>(null);

interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (term: string) => {
    
    setIsSearching(true);
    setError(null);
    setCustomer(null); // Limpa o estado antes da nova busca
    setCustomerData(null); // Também limpa os dados anteriores

    try {
      const response = await axios.post("", { cpf: term });

      if (response.data && response.data.dados && response.data.dados.length > 0) {

        setCustomer(response.data.dados[0]); // Atualiza customer com o primeiro cliente encontrado
        setCustomerData(response.data.dados); // Mantém customerData com todos os dados recebidos
      } else {
        setError("Nenhum cliente encontrado.");
      }

      
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      setError("Comando inexistente! Tente novamente.");
      setTimeout(() =>{
        setError(null)
      }, 5000);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <SearchContext.Provider value={{ isSearching, customer, customerData, error, handleSearch, setCustomer, setCustomerData }}>
      {children}
    </SearchContext.Provider>
  );
};
