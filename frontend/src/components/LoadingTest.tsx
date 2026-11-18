import React from "react";
import { Loading } from "@/components/ui/loading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactDOM from "react-dom/client";

export default function LoadingShowcase() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Loading UI Variations</h1>
      
      <Tabs defaultValue="basic" className="mb-8">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="basic">Animações Básicas</TabsTrigger>
          <TabsTrigger value="work">Animações de Trabalho</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Spinner</CardTitle>
                <CardDescription>Classic spinner animation</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="spinner" text="Carregando..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Dots</CardTitle>
                <CardDescription>Sequential animated dots</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="dots" text="Processando..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Skeleton</CardTitle>
                <CardDescription>Content placeholder skeleton</CardDescription>
              </CardHeader>
              <CardContent className="py-6">
                <Loading variant="skeleton" text="Carregando conteúdo..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Pulse</CardTitle>
                <CardDescription>Pulsating circle animation</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="pulse" text="Atualizando..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardDescription>Progress bar animation</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="progress" text="Carregando dados..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Shimmer</CardTitle>
                <CardDescription>Content shimmer effect</CardDescription>
              </CardHeader>
              <CardContent className="py-6">
                <Loading variant="shimmer" text="Carregando informações..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Hourglass</CardTitle>
                <CardDescription>Bouncing hourglass animation</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="hourglass" text="Por favor, aguarde..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Sparkle</CardTitle>
                <CardDescription>Spinning circle with sparkle effect</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="sparkle" text="Preparando..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Size Variations</CardTitle>
                <CardDescription>Small, medium, and large sizes</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center gap-6 py-6">
                <Loading variant="spinner" size="sm" />
                <Loading variant="spinner" size="md" />
                <Loading variant="spinner" size="lg" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="work">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Typing</CardTitle>
                <CardDescription>Text typing indicator</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="typing" text="Digitando mensagem..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Working</CardTitle>
                <CardDescription>Animated work in progress</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="working" text="Trabalhando na solicitação..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Calculating</CardTitle>
                <CardDescription>Data calculation in progress</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="calculating" text="Calculando valores..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Searching</CardTitle>
                <CardDescription>Content search animation</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="searching" text="Buscando registros..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Coding</CardTitle>
                <CardDescription>Code generation animation</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loading variant="coding" text="Gerando código..." />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Combinations</CardTitle>
                <CardDescription>Different variants</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 py-6">
                <div className="flex flex-col items-center">
                  <Loading variant="working" size="sm" />
                  <span className="text-xs mt-2">Trabalhando</span>
                </div>
                <div className="flex flex-col items-center">
                  <Loading variant="typing" size="sm" />
                  <span className="text-xs mt-2">Digitando</span>
                </div>
                <div className="flex flex-col items-center">
                  <Loading variant="calculating" size="sm" />
                  <span className="text-xs mt-2">Calculando</span>
                </div>
                <div className="flex flex-col items-center">
                  <Loading variant="searching" size="sm" />
                  <span className="text-xs mt-2">Buscando</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Full Page Loading</CardTitle>
            <CardDescription>Click the button to show a full-page loading overlay</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-4 py-6">
            <button 
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              onClick={() => {
                const div = document.createElement('div');
                div.id = 'full-page-loading';
                document.body.appendChild(div);
                
                // Render the full page loading component
                const root = ReactDOM.createRoot(div);
                root.render(<Loading fullPage variant="spinner" text="Carregando..." />);
                
                // Remove after 3 seconds
                setTimeout(() => {
                  const loadingElement = document.getElementById('full-page-loading');
                  if (loadingElement) {
                    document.body.removeChild(loadingElement);
                  }
                }, 3000);
              }}
            >
              Spinner Loading
            </button>
            
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={() => {
                const div = document.createElement('div');
                div.id = 'full-page-loading';
                document.body.appendChild(div);
                
                const root = ReactDOM.createRoot(div);
                root.render(<Loading fullPage variant="working" text="Trabalhando na sua solicitação..." />);
                
                setTimeout(() => {
                  const loadingElement = document.getElementById('full-page-loading');
                  if (loadingElement) {
                    document.body.removeChild(loadingElement);
                  }
                }, 3000);
              }}
            >
              Working Loading
            </button>
            
            <button 
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
              onClick={() => {
                const div = document.createElement('div');
                div.id = 'full-page-loading';
                document.body.appendChild(div);
                
                const root = ReactDOM.createRoot(div);
                root.render(<Loading fullPage variant="calculating" text="Calculando resultados..." />);
                
                setTimeout(() => {
                  const loadingElement = document.getElementById('full-page-loading');
                  if (loadingElement) {
                    document.body.removeChild(loadingElement);
                  }
                }, 3000);
              }}
            >
              Calculating Loading
            </button>
            
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              onClick={() => {
                const div = document.createElement('div');
                div.id = 'full-page-loading';
                document.body.appendChild(div);
                
                const root = ReactDOM.createRoot(div);
                root.render(<Loading fullPage variant="searching" text="Buscando informações..." />);
                
                setTimeout(() => {
                  const loadingElement = document.getElementById('full-page-loading');
                  if (loadingElement) {
                    document.body.removeChild(loadingElement);
                  }
                }, 3000);
              }}
            >
              Searching Loading
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
