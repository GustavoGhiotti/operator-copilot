
import React, { useEffect, useState, useContext } from 'react';
import { X, Phone, MapPin, Calendar, CreditCard, AlertTriangle, Handshake, CheckCircle } from 'lucide-react';
import { Customer } from '../utils/mockData';
import CustomerInfoCard from './CustomerInfoCard';
import { SearchContext } from '@/context/SearchContext';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}





const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose }) => {
  const { customer } = useContext(SearchContext) || {};
  const { customerData } = useContext(SearchContext) || {};
  

  useEffect(() => {
    // Add a class to prevent scrolling when modal is open
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    

    // Clean up on unmount
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  if (!isOpen || !customer) return null;


  // Calculate total debt
  const totalDebt = (customerData || [])
  .filter(contract => contract.status_acordo === 0)
  .reduce((sum, contract) => sum + contract.saldo_devedor, 0);

  
  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Function to determine score color
  const getScoreColor = (score: number) => {
    if (score < 400) return 'text-red-500';
    if (score < 600) return 'text-orange-500';
    return 'text-green-500';
  };

  // Function to determine debt status color
  const getStatusColor = (status: 'overdue' | 'current' | 'negotiating') => {
    switch (status) {
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'current': return 'bg-green-100 text-green-800';
      case 'negotiating': return 'bg-blue-100 text-blue-800';
    }
  };

  // Function to translate status
  const translateStatus = (status) => {
  
    const statusMap = {
      0: { text: "Sem acordo", icon: <X className="text-red-500 w-4 h-4" /> },
      1: { text: "Com acordo", icon: <Handshake className="text-yellow-500 w-4 h-4" /> },
      2: { text: "Acordo Pago", icon: <CheckCircle className="text-green-500 w-4 h-4" /> },
    };
  
    return statusMap[status] || { text: "Desconhecido", icon: null };
  };

  const getFirstAvailableValue = (field: keyof typeof customerData[0]) => {
    return customerData?.map(contract => contract[field]).find(value => value) || "Não informado";
  };

  const uniqueContracts = customerData ? 
  customerData.filter((contract, index, self) =>
    index === self.findIndex(c => c.id_cliente === contract.id_cliente)
  ) : [];
  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-lg shadow-xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{customerData?.[0]?.nome || "Nome não encontrado"}</h2>
            <p className="text-sm text-gray-500">CPF: {customer.cpf}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar p-6 max-h-[calc(90vh-5rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <CustomerInfoCard title="Informações Pessoais">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nome Completo: </span>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{customerData?.[0]?.nome || "Nome não encontrado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">CPF:</span>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{customer.cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Data de Nascimento:</span>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{customerData?.[0]?.data_nascimento || "Não informado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Email:</span>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{getFirstAvailableValue("email")}</span>
                </div>
              </div>
            </CustomerInfoCard>

            {/* Contracts */}
            <CustomerInfoCard title="Contratos">
            {customerData?.map((contract, index) => (
              <div key={index} className="rounded-md p-3 bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CreditCard className="h-4 w-4 text-primary mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{contract.id_cliente}</span>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {contract.carteira}
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {contract.grupo}
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {contract.sub_grupo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Valor:</span>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{formatCurrency(contract.saldo_devedor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Atraso:</span>
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 text-gray-500 mr-1" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{contract.atraso_maior_divida} dias</span>
                  </div>
                </div>
              </div>
            ))}
            </CustomerInfoCard>
            
            {/* Debts */}
            <CustomerInfoCard title="Dívidas" className="md:col-span-2">
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                      <span className="text-sm font-medium">Dívida Total</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      {formatCurrency(totalDebt)}
                    </span>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Carteira
                        </th>
                        <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Atraso
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {customerData?.map((contract, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                            {contract.carteira}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {formatCurrency(contract.saldo_devedor)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {contract.atraso_maior_divida} dias
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                            {translateStatus(contract.status_acordo).icon} {/* Ícone */}
                            <span className="ml-2 text-gray-900">{translateStatus(contract.status_acordo).text}</span> {/* Texto */}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </CustomerInfoCard>
            
            {/* Phone Numbers */}
            <CustomerInfoCard title="Telefones">
              <div className="space-y-3">
              {uniqueContracts.map((contract, index) => (
                  <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md">
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-primary mr-2" />
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-900">{customerData?.[0]?.telefone || "Não informado"}</span>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full capitalize">
                      {contract.type === 'mobile' ? 'Celular' : 
                       contract.type === 'home' ? 'Residencial' : 
                       contract.type === 'work' ? 'Trabalho' : 'Outro'}
                    </span>
                  </div>
                ))}
              </div>
            </CustomerInfoCard>
            
            {/* Addresses */}
            <CustomerInfoCard title="Endereços">
              <div className="space-y-4">
                {customerData?.map((contract, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-primary mr-2" />
                        <span className="text-sm font-medium capitalize text-gray-900">
                          {contract.type === 'home' ? 'Residencial' : 
                           contract.type === 'work' ? 'Trabalho' : 'Residencial'}
                        </span>
                      </div>
                      <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full dark:text-gray-900">
                        {contract.postalCode}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-900">
                    {customerData?.[0]?.nm_cidade || "Não informado"}, {contract.number}
                      {contract.complement && `, ${contract.complement}`}
                    </p>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-900">{contract.neighborhood} - {contract.city}/{contract.state}</p>
                  </div>
                ))}
              </div>
            </CustomerInfoCard>
          </div>
        </div>
        
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors mr-2"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;
