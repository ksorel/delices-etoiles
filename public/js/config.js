<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyCU4Mqn6Wfyy5irKh9DpVoXFasx2N0-gGE",
    authDomain: "delices-etoiles.firebaseapp.com",
    projectId: "delices-etoiles",
    storageBucket: "delices-etoiles.firebasestorage.app",
    messagingSenderId: "795728972354",
    appId: "1:795728972354:web:50403340daee555d66fbdb",
    measurementId: "G-NGFS8MC8CW"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>