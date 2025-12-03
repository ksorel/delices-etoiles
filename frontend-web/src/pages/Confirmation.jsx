import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FaCheckCircle, FaClock, FaPhone, FaHome } from 'react-icons/fa';

const Confirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Données par défaut si aucune n'est passée
  const orderData = location.state?.orderData || {
    firstName: 'Client',
    lastName: '',
    email: 'client@example.com',
    phone: '+225 00 00 00 00',
    deliveryMethod: 'delivery',
  };
  
  const orderId = location.state?.orderId || 'DEL-' + Math.floor(Math.random() * 1000000);
  const estimatedDelivery = location.state?.estimatedDelivery || '45-60 minutes';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* En-tête de confirmation */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaCheckCircle className="text-5xl text-green-600" />
          </div>
          
          <h1 className="text-4xl font-display font-bold text-primary-900 mb-4">
            Commande confirmée !
          </h1>
          
          <p className="text-xl text-primary-700 mb-2">
            Merci pour votre commande, <span className="font-semibold">{orderData.firstName}</span> !
          </p>
          
          <p className="text-primary-600">
            Votre commande a été enregistrée sous le numéro
          </p>
          
          <div className="inline-block bg-primary-900 text-primary-50 text-2xl font-mono font-bold px-6 py-3 rounded-lg mt-4">
            {orderId}
          </div>
        </div>

        {/* Détails de la commande */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Suivi de livraison */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-display font-bold text-primary-900 mb-6 flex items-center">
              <FaClock className="mr-3 text-primary-600" />
              Suivi de commande
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 font-bold">1</span>
                </div>
                <div className="ml-4">
                  <h3 className="font-bold text-primary-900">Commande confirmée</h3>
                  <p className="text-primary-600">Votre commande est en préparation</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold">2</span>
                </div>
                <div className="ml-4">
                  <h3 className="font-medium text-primary-900">En préparation</h3>
                  <p className="text-primary-600">Nos chefs préparent vos plats</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold">3</span>
                </div>
                <div className="ml-4">
                  <h3 className="font-medium text-primary-900">En route</h3>
                  <p className="text-primary-600">Livraison estimée : {estimatedDelivery}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Informations client */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-display font-bold text-primary-900 mb-6 flex items-center">
              <FaHome className="mr-3 text-primary-600" />
              Vos informations
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-primary-700">Nom</h3>
                <p className="text-primary-900 font-semibold">
                  {orderData.firstName} {orderData.lastName}
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-primary-700">Email</h3>
                <p className="text-primary-900">{orderData.email}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-primary-700">Téléphone</h3>
                <p className="text-primary-900">{orderData.phone}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-primary-700">Méthode</h3>
                <p className="text-primary-900">
                  {orderData.deliveryMethod === 'delivery' ? 'Livraison à domicile' : 'À emporter'}
                </p>
              </div>
              
              {orderData.address && (
                <div>
                  <h3 className="font-medium text-primary-700">Adresse de livraison</h3>
                  <p className="text-primary-900">{orderData.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h2 className="text-2xl font-display font-bold text-primary-900 mb-4">
            Besoin d'aide ?
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <div className="flex items-center justify-center p-4 bg-primary-50 rounded-lg">
              <FaPhone className="text-primary-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-primary-900">Appelez-nous</p>
                <p className="text-primary-600">(+225) 0505454866</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Retour à l'accueil
            </Link>
            
            <Link
              to="/menu"
              className="bg-white border-2 border-primary-600 text-primary-600 hover:bg-primary-50 font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Commander à nouveau
            </Link>
          </div>
          
          <p className="text-sm text-primary-500 mt-6">
            Un email de confirmation vous a été envoyé à {orderData.email}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;