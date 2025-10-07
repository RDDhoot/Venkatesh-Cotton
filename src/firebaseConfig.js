// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC47D_HzHgNl1bXyWUDjjSdmLnQKwr8fug",
    authDomain: "vcc-app-7370a.firebaseapp.com",
    projectId: "vcc-app-7370a",
    storageBucket: "vcc-app-7370a.appspot.com",
    messagingSenderId: "1086057062463",
    appId: "1:1086057062463:web:3e516cba1db898c10a588a",
    measurementId: "G-WP74HFRQ1V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db }; // Export the database instance