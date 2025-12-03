import React from 'react';

const PaymentInfo = () => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-primary-900 mb-4">
        💳 Paiement
      </h2>
      
      <div className="space-y-3">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-lg">💰</span>
          </div>
          <div>
            <h3 className="font-medium text-primary-900">Paiement à la livraison</h3>
            <p className="text-sm text-primary-600">Espèces ou carte bancaire acceptées</p>
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🔒</span>
          </div>
          <div>
            <h3 className="font-medium text-primary-900">Transaction sécurisée</h3>
            <p className="text-sm text-primary-600">Vos données sont protégées</p>
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🧾</span>
          </div>
          <div>
            <h3 className="font-medium text-primary-900">Facture disponible</h3>
            <p className="text-sm text-primary-600">Reçu électronique envoyé par email</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentInfo;