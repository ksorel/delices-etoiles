// backend/test-auth-simple.js
async function testAuth() {
  const API_BASE = 'http://localhost:3001/api';
  
  console.log('🧪 Test du système d\'authentification...\n');

  try {
    // 1. Test d'inscription
    console.log('1. Test d\'inscription...');
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@delices-etoiles.ci',
        password: 'password123',
        first_name: 'Test',
        last_name: 'User',
        phone: '+2250700000999'
      })
    });
    
    const registerData = await registerResponse.json();
    
    if (registerResponse.ok) {
      console.log('✅ Inscription réussie:', registerData.message);
    } else {
      console.log('❌ Erreur inscription:', registerData.error);
      // Si l'utilisateur existe déjà, continuer avec la connexion
      if (registerData.error === 'Email déjà utilisé') {
        console.log('ℹ️ Utilisateur existe déjà, test de connexion...');
      } else {
        return;
      }
    }

    // 2. Test de connexion
    console.log('\n2. Test de connexion...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@delices-etoiles.ci',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.log('❌ Erreur connexion:', loginData.error);
      return;
    }
    
    console.log('✅ Connexion réussie:', loginData.message);
    const token = loginData.token;
    console.log('🔐 Token reçu:', token ? token.substring(0, 20) + '...' : 'Aucun token');

    // 3. Test de récupération du profil
    console.log('\n3. Test de récupération du profil...');
    const profileResponse = await fetch(`${API_BASE}/auth/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    const profileData = await profileResponse.json();
    
    if (profileResponse.ok) {
      console.log('✅ Profil récupéré:', profileData.user.email);
    } else {
      console.log('❌ Erreur profil:', profileData.error);
    }

    console.log('\n🎉 Tests d\'authentification terminés!');

  } catch (error) {
    console.error('❌ Erreur réseau:', error.message);
    console.log('💡 Assurez-vous que le serveur est démarré avec: npm run dev');
  }
}

testAuth();