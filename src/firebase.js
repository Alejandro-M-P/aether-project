import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Poniendo las claves directamente aseguramos que no falle
const firebaseConfig = {
	apiKey: "AIzaSyCqT7j462Ui4QVogup6RGym-g2iHHer4qE",
	authDomain: "aether-alejandro-9b32b.firebaseapp.com",
	projectId: "aether-alejandro-9b32b",
	storageBucket: "aether-alejandro-9b32b.firebasestorage.app",
	messagingSenderId: "183118372728",
	appId: "1:183118372728:web:751c92bb7cd8f55857728d",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
