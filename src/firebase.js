import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCqT7j462Ui4QVogup6RGym-g2iHHer4qE",
    authDomain: "aether-alejandro-9b32b.firebaseapp.com",
    projectId: "aether-alejandro-9b32b",
    storageBucket: "aether-alejandro-9b32b.firebasestorage.app",
    messagingSenderId: "183118372728",
    appId: "1:183118372728:web:751c92bb7cd8f55857728d",
};

// Esta línea evita el error de "Duplicate App"
// Si ya existe una app, la usa; si no, la crea.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);