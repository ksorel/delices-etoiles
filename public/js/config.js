import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getStorage }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCU4Mqn6Wfyy5irKh9DpVoXFasx2N0-gGE",
  authDomain:        "delices-etoiles.firebaseapp.com",
  projectId:         "delices-etoiles",
  storageBucket:     "delices-etoiles.firebasestorage.app",
  messagingSenderId: "795728972354",
  appId:             "1:795728972354:web:50403340daee555d66fbdb"
};

const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
export default app;