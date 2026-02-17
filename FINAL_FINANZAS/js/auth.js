import { auth } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { utils } from './utils.js';

export const authManager = {
    isLoginMode: true,

    init: () => {
        const title = document.getElementById('auth-title');
        const submitBtn = document.getElementById('auth-submit');
        const toggleLink = document.getElementById('auth-toggle-link');
        const toggleText = document.getElementById('auth-toggle-text');

        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const googleBtn = document.getElementById('google-login');
        const msg = document.getElementById('auth-message');

        const logoutBtnMobile = document.getElementById('logout-btn-mobile');
        const logoutBtnSidebar = document.getElementById('logout-sidebar');

        // Toggle Function
        if (toggleLink) {
            toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                authManager.toggleAuthMode(title, submitBtn, toggleLink, toggleText, msg);
            });
        }

        // Submit
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const email = emailInput.value;
                const password = passwordInput.value;
                msg.textContent = "";

                if (!email || !password) {
                    msg.textContent = "Por favor, completa todos los campos.";
                    return;
                }

                try {
                    if (authManager.isLoginMode) {
                        await signInWithEmailAndPassword(auth, email, password);
                    } else {
                        await createUserWithEmailAndPassword(auth, email, password);
                    }
                } catch (error) {
                    msg.textContent = authManager.mapAuthError(error.code);
                }
            });
        }

        // Google
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                const provider = new GoogleAuthProvider();
                try {
                    await signInWithPopup(auth, provider);
                } catch (error) {
                    msg.textContent = "Error al conectar con Google.";
                    console.error(error);
                }
            });
        }

        // Logouts
        const handleLogout = () => signOut(auth);
        if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', handleLogout);
        if (logoutBtnSidebar) logoutBtnSidebar.addEventListener('click', handleLogout);
    },

    toggleAuthMode: (title, btn, link, text, msg) => {
        authManager.isLoginMode = !authManager.isLoginMode;
        msg.textContent = ""; // Clear errors

        if (authManager.isLoginMode) {
            title.textContent = "Bienvenido";
            btn.textContent = "Iniciar Sesión";
            text.textContent = "¿No tienes cuenta? ";
            link.textContent = "Crear cuenta nueva";
        } else {
            title.textContent = "Crear Cuenta";
            btn.textContent = "Registrarme";
            text.textContent = "¿Ya tienes cuenta? ";
            link.textContent = "Iniciar Sesión";
        }
    },

    mapAuthError: (code) => {
        switch (code) {
            case 'auth/invalid-email': return 'Email inválido.';
            case 'auth/user-disabled': return 'Usuario deshabilitado.';
            case 'auth/user-not-found': return 'Usuario no encontrado.';
            case 'auth/wrong-password': return 'Contraseña incorrecta.';
            case 'auth/email-already-in-use': return 'Este email ya está en uso.';
            case 'auth/weak-password': return 'La contraseña es muy débil.';
            default: return 'Ocurrió un error inesperado.';
        }
    }
};

document.addEventListener('DOMContentLoaded', authManager.init);
