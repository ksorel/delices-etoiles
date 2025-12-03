import React from 'react';

const DeliveryInfo = () => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-primary-900 mb-4">
        🚚 Livraison
      </h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-primary-900 mb-2">Zones de livraison</h3>
          <ul className="text-sm text-primary-600 space-y-1">
            <li>• Abidjan (Plateau, Cocody, Marcory, Yopougon)</li>
            <li>• Bingerville</li>
            <li>• Grand-Bassam</li>
          </ul>
        </div>
        
        <div>
          <h3 className="font-medium text-primary-900 mb-2">Horaires</h3>
          <p className="text-sm text-primary-600">
            Livraison disponible de 11h à 22h, 7j/7
          </p>
        </div>
        
        <div>
          <h3 className="font-medium text-primary-900 mb-2">Contact</h3>
          <p className="text-sm text-primary-600">
            📞 (+225) 0505454866<br/>
            📞 (+225) 0789802290<br/>
            📧 etoiles-delices@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeliveryInfo;