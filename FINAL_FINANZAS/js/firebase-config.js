import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// TODO: Replace with your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC8yooPQHQ4nXTrUV6006cppZvQuHhn1XE",
    authDomain: "finanzaspersonales-b5ccc.firebaseapp.com",
    projectId: "finanzaspersonales-b5ccc",
    storageBucket: "finanzaspersonales-b5ccc.firebasestorage.app",
    messagingSenderId: "773213373437",
    appId: "1:773213373437:web:ba3a6a754bffc50d570f94"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
