// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace these with your project's config if different
const firebaseConfig = {
  apiKey: "AIzaSyATN6pqzD3TIDOmmrrItBcWDqqVuh4Vll4",
  authDomain: "ai-enabled-smart-bus.firebaseapp.com",
  projectId: "ai-enabled-smart-bus",
  storageBucket: "ai-enabled-smart-bus.firebasestorage.app",
  messagingSenderId: "1080667247910",
  appId: "1:1080667247910:web:530aa4367ee321cf59dde7",
  measurementId: "G-NM2JT4924V"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;