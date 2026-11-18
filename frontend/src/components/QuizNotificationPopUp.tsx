// src/components/QuizNotificationPopup.tsx
import React from 'react';
import { Button } from "@/components/ui/button";
import { Bell, X, ArrowRight } from 'lucide-react';

interface QuizNotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuiz: () => void;
}

const QuizNotificationPopup: React.FC<QuizNotificationPopupProps> = ({ isOpen, onClose, onOpenQuiz }) => {
  if (!isOpen) {
    return null;
  }


  const username = localStorage.getItem('nomeCompleto')
  let FirstName = '';

  if (username) {
    const primeiroNome = username.split(' ')[0];

    if (primeiroNome) {

        FirstName = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
    }
  }

  return (
    <div className="fixed bottom-5 right-8 z-50 animate-fade-in-up">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-primary/10 text-primary p-3 rounded-full">
              <Bell className="h-6 w-6" />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {FirstName}, você tem um desafio!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Há um novo quiz disponível para você responder e acumular pontos.
              </p>
              <div className="mt-4 flex gap-3">
                <Button onClick={onOpenQuiz} className="flex-1">
                  Responder Quiz
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Agora não
                </Button>
              </div>
            </div>
            <div className="ml-[-5]">
               <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="h-5 w-5" />
               </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizNotificationPopup;