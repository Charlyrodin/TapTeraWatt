// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAQdT0PvE_3vB-rXLyaVXB5DJS7TH0bibw",
  authDomain: "tap-terawatt.firebaseapp.com",
  projectId: "tap-terawatt",
  storageBucket: "tap-terawatt.firebasestorage.app",
  messagingSenderId: "959402880072",
  appId: "1:959402880072:web:3e46f8bdc994439554fc7d",
  measurementId: "G-MXK3NJEGTG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

  console.log("🔥 Firebase inicializado correctamente");