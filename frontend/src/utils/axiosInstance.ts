import axios from "axios";
import { toast } from "@/components/ui/use-toast"; // ajuste se seu hook for diferente

const axiosInstance = axios.create();

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("userToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const skipAuthRedirect = Boolean((error.config as { skipAuthRedirect?: boolean } | undefined)?.skipAuthRedirect);

    if (status === 401 && !skipAuthRedirect) {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para continuar.",
        variant: "destructive"
      });

      localStorage.clear();

      // pequeno delay antes de redirecionar (pra dar tempo de ver o toast)
      setTimeout(() => {
        window.location.href = "/login";
      }, 2500);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
