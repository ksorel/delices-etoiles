import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

const OrderForm = ({ onSubmit, isSubmitting }) => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [deliveryMethod, setDeliveryMethod] = useState('delivery');

  const handleFormSubmit = (data) => {
    onSubmit({
      ...data,
      deliveryMethod,
      paymentMethod: 'cash', // Par défaut, paiement à la livraison
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-display font-bold text-primary-900 mb-6">
        Informations de livraison
      </h2>
      
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Méthode de livraison */}
        <div className="mb-6">
          <label className="block text-primary-700 font-medium mb-3">
            Méthode de réception
          </label>
          <div className="flex space-x-4">
            <button
              type="button"
              className={`flex-1 py-3 px-4 rounded-lg border-2 text-center transition-all ${deliveryMethod === 'delivery' 
                ? 'border-primary-600 bg-primary-50 text-primary-900' 
                : 'border-primary-200 text-primary-700 hover:border-primary-300'}`}
              onClick={() => setDeliveryMethod('delivery')}
            >
              <span className="block text-lg">🚚</span>
              <span className="block font-medium mt-1">Livraison</span>
              <span className="block text-sm mt-1">45-60 min</span>
            </button>
            <button
              type="button"
              className={`flex-1 py-3 px-4 rounded-lg border-2 text-center transition-all ${deliveryMethod === 'pickup' 
                ? 'border-primary-600 bg-primary-50 text-primary-900' 
                : 'border-primary-200 text-primary-700 hover:border-primary-300'}`}
              onClick={() => setDeliveryMethod('pickup')}
            >
              <span className="block text-lg">🏪</span>
              <span className="block font-medium mt-1">À emporter</span>
              <span className="block text-sm mt-1">20-30 min</span>
            </button>
          </div>
        </div>

        {/* Informations personnelles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-primary-700 font-medium mb-2">
              Prénom *
            </label>
            <input
              type="text"
              {...register('firstName', { required: 'Le prénom est requis' })}
              className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Votre prénom"
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-primary-700 font-medium mb-2">
              Nom *
            </label>
            <input
              type="text"
              {...register('lastName', { required: 'Le nom est requis' })}
              className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Votre nom"
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-primary-700 font-medium mb-2">
            Email *
          </label>
          <input
            type="email"
            {...register('email', { 
              required: 'L\'email est requis',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Email invalide'
              }
            })}
            className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="votre@email.com"
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-primary-700 font-medium mb-2">
            Téléphone *
          </label>
          <input
            type="tel"
            {...register('phone', { 
              required: 'Le téléphone est requis',
              pattern: {
                value: /^[0-9+\s()-]{10,}$/,
                message: 'Numéro de téléphone invalide'
              }
            })}
            className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="(+225) 01 23 45 67 89"
          />
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
          )}
        </div>

        {/* Adresse de livraison (seulement si livraison choisie) */}
        {deliveryMethod === 'delivery' && (
          <>
            <div>
              <label className="block text-primary-700 font-medium mb-2">
                Adresse *
              </label>
              <input
                type="text"
                {...register('address', { 
                  required: deliveryMethod === 'delivery' ? 'L\'adresse est requise' : false 
                })}
                className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Numéro, rue, quartier"
              />
              {errors.address && (
                <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-primary-700 font-medium mb-2">
                  Ville *
                </label>
                <input
                  type="text"
                  {...register('city', { 
                    required: deliveryMethod === 'delivery' ? 'La ville est requise' : false 
                  })}
                  className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Abidjan"
                  defaultValue="Abidjan"
                />
                {errors.city && (
                  <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>
                )}
              </div>

              <div>
                <label className="block text-primary-700 font-medium mb-2">
                  Code postal
                </label>
                <input
                  type="text"
                  {...register('postalCode')}
                  className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="00225"
                />
              </div>

              <div>
                <label className="block text-primary-700 font-medium mb-2">
                  Étage / Appartement
                </label>
                <input
                  type="text"
                  {...register('apartment')}
                  className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Étage, porte, etc."
                />
              </div>
            </div>
          </>
        )}

        {/* Instructions spéciales */}
        <div>
          <label className="block text-primary-700 font-medium mb-2">
            Instructions spéciales
          </label>
          <textarea
            {...register('specialInstructions')}
            rows="3"
            className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Allergies, code de portail, préférences de préparation..."
          />
        </div>

        {/* Bouton de soumission */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Traitement de votre commande...
              </span>
            ) : (
              'Confirmer la commande'
            )}
          </button>
          
          <p className="text-sm text-primary-500 mt-3 text-center">
            En passant commande, vous acceptez nos conditions générales de vente
          </p>
        </div>
      </form>
    </div>
  );
};

export default OrderForm;