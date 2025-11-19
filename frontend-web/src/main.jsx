console.log('Délices Étoiles Frontend - Chargement...');

// Message simple pour confirmer que le frontend fonctionne
document.getElementById('root').innerHTML = `
  <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
    <h1>🍽️ Délices Étoiles</h1>
    <p>Bienvenue sur notre application restaurant</p>
    <p>L'application est en cours de développement</p>
    <p>Backend API: <a href="http://localhost:3001/api/health" target="_blank">Vérifier le statut</a></p>
    <div id="status" style="margin-top: 20px;"></div>
  </div>
`;

// Tester la connexion à l'API backend
fetch('http://localhost:3001/api/health')
  .then(response => response.json())
  .then(data => {
    document.getElementById('status').innerHTML = `
      <p style="color: green;">✅ Backend connecté: ${data.message}</p>
      <p>Timestamp: ${data.timestamp}</p>
    `;
  })
  .catch(error => {
    document.getElementById('status').innerHTML = `
      <p style="color: red;">❌ Backend non disponible: ${error.message}</p>
    `;
  });