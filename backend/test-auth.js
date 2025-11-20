// backend/test-auth.js
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

async function testAuth() {
  try {
    console.log('🧪 Test du système d\'authentification...\n');

    // 1. Test d'inscription
    console.log('1. Test d\'inscription...');
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: 'test@delices-etoiles.ci',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User',
      phone: '+2250700000999'
    });
    console.log('✅ Inscription réussie:', registerResponse.data.message);

    // 2. Test de connexion
    console.log('\n2. Test de connexion...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@delices-etoiles.ci',
      password: 'password123'
    });
    console.log('✅ Connexion réussie:', loginResponse.data.message);
    
    const token = loginResponse.data.token;
    console.log('🔐 Token reçu:', token.substring(0, 20) + '...');

    // 3. Test de récupération du profil
    console.log('\n3. Test de récupération du profil...');
    const profileResponse = await axios.get(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profil récupéré:', profileResponse.data.user.email);

    console.log('\n🎉 Tous les tests d\'authentification sont réussis!');

  } catch (error) {
    if (error.response) {
      console.error('❌ Erreur:', error.response.data);
    } else {
      console.error('❌ Erreur:', error.message);
    }
  }
}

testAuth();