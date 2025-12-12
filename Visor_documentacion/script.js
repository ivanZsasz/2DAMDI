import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    updatePassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc, where, updateDoc, arrayUnion, deleteDoc, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- GLOBAL ERROR HANDLER (DEBUGGING) ---
window.onerror = function (msg, url, lineNo, columnNo, error) {
    alert(`Error Crítico en Script:\n${msg}\nLínea: ${lineNo}\nColumna: ${columnNo}\nError: ${error}`);
    return false;
};
window.addEventListener('unhandledrejection', function (event) {
    alert(`Promesa Rechazada (Posible error Firestore):\n${event.reason}`);
});

// --- 1. TU CONFIGURACIÓN REAL DE FIREBASE (MANTÉN LA TUYA) ---
const firebaseConfig = {
    apiKey: "AIzaSyBuus8C6eWYLtrJyAVv_c0LiMLQd3UeCa0",
    authDomain: "visorarchivos-97a16.firebaseapp.com",
    projectId: "visorarchivos-97a16",
    storageBucket: "visorarchivos-97a16.firebasestorage.app",
    messagingSenderId: "839228518206",
    appId: "1:839228518206:web:eb99cb8f10bf66c544066f",
    measurementId: "G-NZY1EVLRBE"
};

// Inicializar servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- 2. REFERENCIAS AL DOM (ACTUALIZADAS) ---
// Contenedores principales
const loginOverlay = document.getElementById('login-overlay');
const mainAppContainer = document.getElementById('main-app-container');

// Botones y Auth UI (Header principal)
const appHeader = document.getElementById('app-header');
// Settings UI
const settingsBtn = document.getElementById('settings-btn');
const settingsDropdown = document.getElementById('settings-dropdown');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
// const accTextLarge = document.getElementById('acc-text-large'); // REMOVED
const accDyslexia = document.getElementById('acc-dyslexia');
const accWarm = document.getElementById('acc-warm');

const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

// Uploader y Feed
const filesList = document.getElementById('files-list');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const progressContainer = document.getElementById('upload-progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// --- NUEVAS REFERENCIAS FOLDER SYSTEM ---
const dashboardView = document.getElementById('dashboard-view');
const folderView = document.getElementById('folder-view');
const foldersGrid = document.getElementById('folders-grid');
const currentFolderName = document.getElementById('current-folder-name');
const btnBackDashboard = document.getElementById('btn-back-dashboard');

// Delete Modal
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

// State for Rename/Delete
let editingFolderId = null;
let folderToDeleteId = null;
let fileToDeleteId = null;
let itemToDeleteType = null; // 'folder' or 'file'

// Modal
const createFolderModal = document.getElementById('create-folder-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const createFolderForm = document.getElementById('create-folder-form');
const folderNameInput = document.getElementById('folder-name');

// Invite Modal
const inviteModal = document.getElementById('invite-modal');
const btnCloseInviteModal = document.getElementById('btn-close-invite-modal');
const inviteForm = document.getElementById('invite-form');
const inviteUsernameInput = document.getElementById('invite-username');
const btnInviteMember = document.getElementById('btn-invite-member');

// Advanced Features Refs
const btnFolderMenu = document.getElementById('btn-folder-menu');
const folderMenuDropdown = document.getElementById('folder-menu-dropdown');
const btnMenuArchived = document.getElementById('btn-menu-archived');
const btnMenuActivity = document.getElementById('btn-menu-activity');
const btnMenuMembers = document.getElementById('btn-menu-members');

const archivedModal = document.getElementById('archived-files-modal');
const btnCloseArchived = document.getElementById('btn-close-archived');
const archivedList = document.getElementById('archived-list');

const activityModal = document.getElementById('activity-log-modal');
const btnCloseActivity = document.getElementById('btn-close-activity');
const activityList = document.getElementById('activity-list');

const membersModal = document.getElementById('folder-members-modal');
const btnCloseMembers = document.getElementById('btn-close-members');
const membersList = document.getElementById('members-list');
const btnOpenInviteModal = document.getElementById('btn-open-invite-modal'); // Inside members modal

// Code Viewer Elements
const codeViewerModal = document.getElementById('code-viewer-modal');
const btnCloseCodeViewer = document.getElementById('btn-close-code-viewer');
const codeViewerContent = document.getElementById('code-viewer-content');
const codeViewerTitle = document.getElementById('code-viewer-title');

const renameFileModal = document.getElementById('rename-file-modal');
const btnCloseRename = document.getElementById('btn-close-rename-file');
const renameFileForm = document.getElementById('rename-file-form');
const renameFileInput = document.getElementById('file-rename-input');
let fileToRenameId = null;

const moveFileModal = document.getElementById('move-file-modal');
const btnCloseMove = document.getElementById('btn-close-move');
const moveFoldersList = document.getElementById('move-folders-list');

let fileToMoveId = null;
let allFoldersCache = []; // Cache global para mover archivos


let activeFolderId = null; // ID de la carpeta actual (null = dashboard)
let unsubscribeFiles = null;
let unsubscribeFolders = null;

// --- NUEVAS REFERENCIAS AUTH ---
// Views
const authViews = {
    home: document.getElementById('auth-view-home'),
    login: document.getElementById('auth-view-login'),
    register1: document.getElementById('auth-view-register-1'),
    registerSent: document.getElementById('auth-view-register-sent'),
    register2: document.getElementById('auth-view-register-2'),
    registerSuccess: document.getElementById('auth-view-register-success'),
};

// Inputs & Forms
const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-password');
const regEmail = document.getElementById('reg-email');
const regUsername = document.getElementById('reg-username');
const regPass = document.getElementById('reg-pass');
const regPassConfirm = document.getElementById('reg-pass-confirm');
const strengthBar = document.getElementById('strength-bar');
const strengthText = document.getElementById('strength-text');

// Buttons
const btnToLogin = document.getElementById('to-login-btn');
const btnToRegister = document.getElementById('to-register-btn');
const googleLoginBtnHero = document.getElementById('google-login-btn-hero');
const btnBackHomeSent = document.getElementById('btn-back-home-sent');
const btnEnterApp = document.getElementById('btn-enter-app');

// --- 3. TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-content">
            <span class="toast-message">${message}</span>
        </div>
    `;

    // Click to dismiss
    toast.addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// --- 3.1 GESTIÓN DE VISTAS AUTH ---
function showAuthView(viewName) {
    Object.values(authViews).forEach(el => el.classList.add('hidden'));
    authViews[viewName].classList.remove('hidden');
}

// Event Listeners Navegación
if (btnToLogin) btnToLogin.addEventListener('click', () => showAuthView('login'));
if (btnToRegister) btnToRegister.addEventListener('click', () => showAuthView('register1'));
if (btnBackHomeSent) btnBackHomeSent.addEventListener('click', () => showAuthView('home'));
if (btnEnterApp) {
    btnEnterApp.addEventListener('click', () => {
        isFinishingRegistration = false;
        initMainApp(auth.currentUser);
    });
}

document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.target; // 'home'
        showAuthView(target);
    });
});

// --- 3. INIT APP & LISTENERS ---
// Settings Menu Toggle
if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('hidden');
    });
}

// Close Menu on Click Outside (Settings & Folder Options)
document.addEventListener('click', (e) => {
    // 1. Settings Menu
    if (settingsDropdown && !settingsDropdown.classList.contains('hidden')) {
        if (!settingsDropdown.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsDropdown.classList.add('hidden');
        }
    }
    // 2. Folder Options Menus
    document.querySelectorAll('.folder-options-menu').forEach(menu => {
        if (!menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
        }
    });
});

// Theme Toggle
if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    });
}

// Accessibility Toggles
function setupAccToggle(element, className) {
    if (element) {
        element.addEventListener('change', () => {
            if (element.checked) {
                document.body.classList.add(className);
                localStorage.setItem(className, 'true');
            } else {
                document.body.classList.remove(className);
                localStorage.setItem(className, 'false');
            }
        });
    }
}
// setupAccToggle(accTextLarge, 'acc-large'); // REMOVED
setupAccToggle(accDyslexia, 'acc-dyslexia');
setupAccToggle(accWarm, 'acc-warm');

// Load Preferences
function loadPreferences() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.checked = true;
    }

    /* REMOVED LARGE TEXT
    if (localStorage.getItem('acc-large') === 'true') {
        document.body.classList.add('acc-large');
        if(accTextLarge) accTextLarge.checked = true;
    } */

    if (localStorage.getItem('acc-dyslexia') === 'true') {
        document.body.classList.add('acc-dyslexia');
        if (accDyslexia) accDyslexia.checked = true;
    }
    if (localStorage.getItem('acc-warm') === 'true') {
        document.body.classList.add('acc-warm');
        if (accWarm) accWarm.checked = true;
    }
}

// Call loadPreferences on startup
loadPreferences();

if (logoutBtn) logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        // ... (existing logout logic is handled by onAuthStateChanged)
    }).catch(err => console.error(err));
});

// --- 4. LÓGICA DE AUTH (LOGIN / REGISTER) ---
const provider = new GoogleAuthProvider();
let isFinishingRegistration = false; // Flag para controlar el flujo "Set Password"

// 4.1 Login con Google
googleLoginBtnHero.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => console.error(err));
});

// 4.2 Login con Email/Password
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPass.value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            console.error("Login Error:", error);
            showToast("Error: " + error.message, 'error');
        });
});

// 4.3 Registro Paso 1: Enviar Link
document.getElementById('register-email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = regEmail.value;

    const actionCodeSettings = {
        url: window.location.href, // Volver a la misma URL
        handleCodeInApp: true
    };

    sendSignInLinkToEmail(auth, email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignIn', email);
            document.getElementById('sent-to-email').textContent = email;
            showAuthView('registerSent');
        })
        .catch((error) => {
            console.error("Error sending email link:", error);
            showToast("Error al enviar correo: " + error.message, 'error');
        });
});

// 4.4 Registro Paso 2: Detectar Link al cargar
if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
        email = window.prompt('Por favor, confirma tu correo para finalizar el registro:');
    }

    if (email) {
        isFinishingRegistration = true; // Bloquear transición a Home, mostrar Set Password

        signInWithEmailLink(auth, email, window.location.href)
            .then((result) => {
                window.localStorage.removeItem('emailForSignIn');
                // Usuario logueado, ahora mostramos pantalla de crear password
                showAuthView('register2');
                // Limpiar URL
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch((error) => {
                isFinishingRegistration = false;
                console.error("Link Error:", error);
                showToast("Enlace inválido o expirado. Intenta registrarte de nuevo.", 'error');
                showAuthView('home');
            });
    }
}

// 4.5 Registro Paso 3: Establecer Password y Usuario
document.getElementById('register-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = regPass.value;
    const p2 = regPassConfirm.value;
    const username = regUsername.value.trim();

    if (p1 !== p2) {
        showToast("Las contraseñas no coinciden.", 'warning');
        return;
    }

    if (username.length < 3) {
        showToast("El nombre de usuario debe tener al menos 3 caracteres.", 'warning');
        return;
    }

    const user = auth.currentUser;
    if (user) {
        try {
            // 1. Verificar unicidad del username
            const usernameRef = doc(db, "usernames", username);
            const usernameSnap = await getDoc(usernameRef);

            if (usernameSnap.exists()) {
                showToast(`El usuario "${username}" ya está en uso. Por favor elige otro.`, 'warning');
                return;
            }

            // 2. Si está libre, lo reservamos y actualizamos perfil
            // Usamos Promise.all para hacerlo en paralelo, pero la reserva es crítica
            await setDoc(usernameRef, { uid: user.uid });
            await updateProfile(user, { displayName: username });
            await updatePassword(user, p1);

            showAuthView('registerSuccess');
            // Note: isFinishingRegistration remains true until they click "Enter App"

        } catch (error) {
            console.error("Registration finalization error:", error);
            showToast("Error al finalizar registro: " + error.message, 'error');
        }
    }
});

// Medidor de Fuerza de Contraseña
regPass.addEventListener('input', (e) => {
    const val = e.target.value;
    let strength = 0;
    if (val.length >= 6) strength++;
    if (val.length >= 10) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;

    let width = '0%';
    let color = 'var(--text-muted)';
    let text = 'Muy débil';

    if (strength === 0) { width = '0%'; }
    else if (strength < 3) { width = '30%'; color = 'var(--primary-light)'; text = 'Débil'; strengthBar.className = 'strength-bar strength-weak'; }
    else if (strength < 5) { width = '70%'; color = '#f59e0b'; text = 'Buena'; strengthBar.className = 'strength-bar strength-medium'; }
    else { width = '100%'; color = 'var(--success)'; text = 'Fuerte'; strengthBar.className = 'strength-bar strength-strong'; }

    strengthBar.style.width = width;
    strengthText.textContent = `Seguridad: ${text}`;
});

// --- 5. MONITOR DE ESTADO GENERAL ---
onAuthStateChanged(auth, (user) => {
    // Si estamos en medio del flujo de "Completar Registro" (Set Password),
    // NO interrumpimos mostrando la app principal todavía.
    if (isFinishingRegistration) return;

    if (user) {
        initMainApp(user);
    } else {
        hideMainApp();
    }
});

// 4.6 Asegurar Username para Google Auth
async function ensureGoogleUsername(user) {
    // 1. Revisar si ya tiene documento en "users"
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        // Ya tiene setup completo
        return userSnap.data().username;
    }

    // 2. No tiene setup -> Generar Username
    let baseName = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let finalName = baseName;
    let isAvailable = false;
    let attempts = 0;

    while (!isAvailable && attempts < 5) {
        const checkRef = doc(db, "usernames", finalName);
        const checkSnap = await getDoc(checkRef);
        if (!checkSnap.exists()) {
            isAvailable = true;
        } else {
            // Si el UID coincide, es que recuperamos una cuenta huérfana (raro pero posible)
            if (checkSnap.data().uid === user.uid) {
                isAvailable = true;
            } else {
                // Ocupado por otro -> random suffix
                finalName = `${baseName}${Math.floor(Math.random() * 10000)}`;
                attempts++;
            }
        }
    }

    if (!isAvailable) {
        showToast("No se pudo generar un usuario único.", 'error');
        return baseName; // Fallback
    }

    // 3. Guardar en Firestore
    try {
        const batchIsolator = async () => {
            // Batch manually or parallel promises
            await setDoc(doc(db, "usernames", finalName), { uid: user.uid });
            await setDoc(userRef, {
                username: finalName,
                email: user.email,
                createdAt: serverTimestamp()
            });
        };
        await batchIsolator();

        // 4. Actualizar Auth Profile
        if (user.displayName !== finalName) {
            await updateProfile(user, { displayName: finalName });
        }

        showToast(`Bienvenido, ${finalName}`, 'success');
        return finalName;

    } catch (e) {
        console.error("Error setup user:", e);
        showToast("Error configurando usuario", 'error');
        return baseName;
    }
}


async function initMainApp(user) {
    // 0. Asegurar que tiene username (si viene de Google)
    await ensureGoogleUsername(user);

    // 1. Actualizar info del header
    // Si es registro nuevo por email, photoURL puede ser null -> usar placeholder
    userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`;
    // Usar displayName actualizado
    userName.textContent = user.displayName || user.email.split('@')[0];

    // 2. Iniciar la escucha de datos (Carpetas)
    subscribeToFolders(user.uid);

    // 3. Animación de salida del login overlay
    loginOverlay.classList.add('fade-out');

    // 4. Mostrar app
    setTimeout(() => {
        mainAppContainer.classList.remove('hidden');
        // Por defecto vamos al dashboard
        closeFolder();
    }, 400);
}

function hideMainApp() {
    mainAppContainer.classList.add('hidden');
    loginOverlay.classList.remove('fade-out');
    // Reset view to home
    showAuthView('home');

    filesList.innerHTML = '<div class="loading-spinner">Desconectado del córtex.</div>';
    if (unsubscribeFiles) unsubscribeFiles();
    if (unsubscribeFolders) unsubscribeFolders();
}

// --- 6. SISTEMA DE CARPETAS ---


// Navegación
function openFolder(folderId, name, color) {
    activeFolderId = folderId;
    dashboardView.classList.add('hidden');
    appHeader.classList.add('hidden'); // Ocultar barra superior
    folderView.classList.remove('hidden');
    currentFolderName.textContent = name;
    currentFolderName.style.color = color;

    // Cargar archivos de esta carpeta
    subscribeToFiles(folderId);
}

function closeFolder() {
    activeFolderId = null;
    folderView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    appHeader.classList.remove('hidden'); // Mostrar barra superior
    if (unsubscribeFiles) unsubscribeFiles(); // Dejar de escuchar archivos
    filesList.innerHTML = '<div class="loading-spinner">Conectando con el córtex...</div>';
}

// Event Listeners
if (btnCloseModal) btnCloseModal.addEventListener('click', () => createFolderModal.classList.add('hidden'));
if (btnBackDashboard) btnBackDashboard.addEventListener('click', closeFolder);

// Invite Listeners
if (btnInviteMember) btnInviteMember.addEventListener('click', () => inviteModal.classList.remove('hidden'));
if (btnCloseInviteModal) btnCloseInviteModal.addEventListener('click', () => inviteModal.classList.add('hidden'));

// Crear Carpeta
if (createFolderForm) {
    createFolderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = folderNameInput.value.trim();
        const color = document.querySelector('input[name="folder-color"]:checked').value;

        // Validar nombre
        if (!name) return;

        try {
            if (editingFolderId) {
                // --- EDIT MODE (RENAME) ---
                const folderRef = doc(db, "folders", editingFolderId);
                await updateDoc(folderRef, {
                    name: name,
                    color: color,
                    // optional: updatedAt: serverTimestamp()
                });
                showToast("Carpeta renombrada", 'success');
                editingFolderId = null;
            } else {
                // --- CREATE MODE ---
                const newDoc = await addDoc(collection(db, "folders"), {
                    name: name,
                    color: color,
                    ownerId: auth.currentUser.uid,
                    members: [auth.currentUser.uid], // Owner is first member
                    createdAt: serverTimestamp()
                });
                // Log creation activity inside the new folder
                await logActivity(newDoc.id, "creó la carpeta", "create");

                showToast("Carpeta creada", 'success');
            }
            createFolderModal.classList.add('hidden');
            createFolderForm.reset();
        } catch (error) {
            console.error("Error carpeta:", error);
            showToast("Error al guardar carpeta", 'error');
        }
    });
}

// --- RESET FORM ON OPEN NEW ---
// (We'll attach this logic to the "New Folder" card/button)
function openCreateModal() {
    editingFolderId = null;
    document.getElementById('modal-title').textContent = 'Nueva Carpeta';
    createFolderForm.reset();
    createFolderModal.classList.remove('hidden');
}

// --- DELETE LOGIC (Unified) ---
if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener('click', () => deleteConfirmModal.classList.add('hidden'));
if (btnCancelDelete) btnCancelDelete.addEventListener('click', () => deleteConfirmModal.classList.add('hidden'));

function openDeleteModal(type, id) {
    itemToDeleteType = type;
    const titleEl = document.getElementById('delete-modal-title');
    const textEl = document.getElementById('delete-modal-text');

    if (type === 'folder') {
        folderToDeleteId = id;
        titleEl.textContent = 'Eliminar Carpeta';
        textEl.innerHTML = '¿Estás seguro de que quieres eliminar esta carpeta? <br><small>Esta acción no se puede deshacer.</small>';
    } else if (type === 'file') {
        fileToDeleteId = id;
        titleEl.textContent = 'Eliminar Archivo';
        textEl.innerHTML = '¿Estás seguro de que quieres eliminar este archivo? <br><small>Desaparecerá de la lista para todos.</small>';
    }
    deleteConfirmModal.classList.remove('hidden');
}

if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', async () => {
    if (itemToDeleteType === 'folder' && folderToDeleteId) {
        try {
            await deleteDoc(doc(db, "folders", folderToDeleteId));
            showToast("Carpeta eliminada", 'success');
            // No folder-level activity log usually, unless we log to "system"? Skip for now.
            deleteConfirmModal.classList.add('hidden');
            folderToDeleteId = null;
        } catch (error) {
            console.error("Error eliminando carpeta:", error);
            showToast("Error al eliminar", 'error');
        }
    } else if (itemToDeleteType === 'file' && fileToDeleteId) {
        try {
            await deleteDoc(doc(db, "files", fileToDeleteId));
            await logActivity(activeFolderId, "eliminó un archivo", "delete");
            showToast("Archivo eliminado", 'success');
            deleteConfirmModal.classList.add('hidden');
            fileToDeleteId = null;
        } catch (error) {
            console.error("Error eliminando archivo:", error);
            showToast("Error al eliminar archivo", 'error');
        }
    }
});
/*
async function inviteUserToFolder(username) {
   // ... (existing code for invite)
} */

// Invitar Usuario
if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameToAdd = inviteUsernameInput.value.trim();

        if (!activeFolderId) return;

        try {
            // 1. Obtener UID del usuario
            const usernameRef = doc(db, "usernames", usernameToAdd);
            const usernameSnap = await getDoc(usernameRef);

            if (!usernameSnap.exists()) {
                showToast(`El usuario "${usernameToAdd}" no existe.`, 'error');
                return;
            }

            const targetUid = usernameSnap.data().uid;

            // 2. Actualizar carpeta
            const folderRef = doc(db, "folders", activeFolderId);
            await updateDoc(folderRef, {
                members: arrayUnion(targetUid)
            });

            inviteModal.classList.add('hidden');
            inviteUsernameInput.value = '';

            // Log Activity
            await logActivity(activeFolderId, `invitó a ${usernameToAdd}`, 'info');

            showToast(`Usuario ${usernameToAdd} invitado correctamente.`, 'success');

        } catch (error) {
            console.error("Error invitando:", error);
            showToast("Error al enviar invitación.", 'error');
        }
    });
}

// Suscripción Carpetas
function subscribeToFolders(uid) {
    if (unsubscribeFolders) unsubscribeFolders();

    // Query: Carpetas donde soy miembro (reemplaza a ownerId)
    // REQUIERE ÍNDICE COMPUESTO: members (array-contains) + createdAt (desc)
    const q = query(collection(db, "folders"), where("members", "array-contains", uid), orderBy("createdAt", "desc"));

    unsubscribeFolders = onSnapshot(q, (snapshot) => {
        try {
            foldersGrid.innerHTML = '';
            allFoldersCache = []; // Store for "Move" feature

            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                allFoldersCache.push(data);
            });

            // 1. Siempre mostrar tarjeta "Nueva Carpeta" primero
            const newFolderCard = document.createElement('div');
            newFolderCard.className = 'folder-card new-folder';
            newFolderCard.innerHTML = `
            <i class="fa-solid fa-plus"></i>
            <span>Nueva Carpeta</span>
        `;
            newFolderCard.addEventListener('click', () => openCreateModal());
            foldersGrid.appendChild(newFolderCard);

            if (snapshot.empty) {
                return;
            }

            snapshot.forEach(doc => {
                const f = doc.data();
                const el = document.createElement('div');
                el.className = 'folder-card';
                el.style.setProperty('--folder-color', f.color || 'var(--primary)');

                // CARD CONTENT (Clickable Area)
                const contentDiv = document.createElement('div');
                contentDiv.style.cssText = "flex:1; display:flex; flex-direction:column; justify-content:space-between; padding-top:10px;";

                // OPTIONS BUTTON
                const btnOptions = document.createElement('button');
                btnOptions.className = 'btn-folder-options';
                btnOptions.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';

                // OPTIONS MENU
                const menu = document.createElement('div');
                menu.className = 'folder-options-menu hidden';
                menu.innerHTML = `
                <button class="folder-option-item btn-opt-rename"><i class="fa-solid fa-pen"></i> Cambiar Nombre</button>
                <button class="folder-option-item danger btn-opt-delete"><i class="fa-solid fa-trash"></i> Eliminar</button>
            `;

                // Toggle Menu
                btnOptions.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.folder-options-menu').forEach(m => {
                        if (m !== menu) m.classList.add('hidden');
                    });
                    menu.classList.toggle('hidden');
                });

                // MENU ACTIONS
                const btnRename = menu.querySelector('.btn-opt-rename');
                btnRename.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.add('hidden');
                    openRenameModal(doc.id, f.name);
                });

                const btnDelete = menu.querySelector('.btn-opt-delete');
                btnDelete.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.add('hidden');
                    openDeleteModal('folder', doc.id);
                });

                // MAIN CLICK (Open Folder)
                contentDiv.addEventListener('click', () => {
                    openFolder(doc.id, f.name, f.color);
                });

                // Assemble
                contentDiv.innerHTML = `
                <div style="font-size: 2.2rem; color: var(--folder-color); margin-bottom:10px;">
                    <i class="fa-solid fa-folder"></i>
                </div>
                <div style="font-weight:600; color:var(--text-main); word-break:break-word; line-height:1.2;">
                    ${f.name}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:5px;">
                   ${f.filesCount || 0} archivos • ${f.members ? f.members.length : 1} miembros
                </div>
            `;

                el.appendChild(btnOptions);
                el.appendChild(menu);
                el.appendChild(contentDiv);
                foldersGrid.appendChild(el);
            });

        } catch (e) {
            console.error("Error processing folders:", e);
        }
    }, (error) => {
        console.error("Error subscribing to folders:", error);

        // Show fallback UI in case of index error or permission error
        foldersGrid.innerHTML = '';
        const newFolderCard = document.createElement('div');
        newFolderCard.className = 'folder-card new-folder';
        newFolderCard.innerHTML = `<i class="fa-solid fa-plus"></i><span>Nueva Carpeta</span>`;
        newFolderCard.addEventListener('click', () => openCreateModal());
        foldersGrid.appendChild(newFolderCard);

        if (error.code === 'failed-precondition') {
            showToast("Falta Índice en Firestore. Abre consola.", 'warning');
            const err = document.createElement('p');
            err.style.color = 'red';
            err.style.gridColumn = '1/-1';
            err.textContent = 'Error: Falta Índice (mira la consola)';
            foldersGrid.appendChild(err);
        }
    });
}


// --- 4. LÓGICA DE SUBIDA (Storage + Firestore) ---
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault(); dropZone.classList.add('drop-zone--active');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--active'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drop-zone--active');
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFileUpload(fileInput.files[0]);
});

async function handleFileUpload(file) {
    if (!auth.currentUser) return;

    // Reset UI
    progressFill.style.width = '0%';
    progressContainer.classList.remove('hidden');
    dropZone.classList.add('hidden');

    const storageRef = ref(storage, `cortex_docs/${activeFolderId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressFill.style.width = progress + '%';
            // Texto de progreso más "tech"
            progressText.textContent = `Sincronizando sinapsis... ${Math.round(progress)}%`;
        },
        (error) => {
            console.error("Error subida:", error);
            showToast("Fallo en la conexión neuronal (Error al subir).", 'error');
            resetUploaderUI();
        },
        async () => {
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await saveFileMetadata(file, downloadURL);
                await logActivity(activeFolderId, `subió ${file.name}`, 'upload');
                resetUploaderUI();
            } catch (error) {
                console.error("Error post-carga:", error);
                showToast("Error al finalizar la subida: " + error.message, 'error');
                resetUploaderUI();
            }
        }
    );
}

async function saveFileMetadata(file, url) {
    if (!activeFolderId) {
        showToast("Error: No hay carpeta seleccionada", 'error');
        return;
    }

    try {
        await addDoc(collection(db, "files"), {
            name: file.name,
            url: url,
            type: file.name.split('.').pop().toLowerCase(),
            size: file.size,
            uploadedBy: auth.currentUser.displayName ? auth.currentUser.displayName.split(' ')[0] : 'Anon',
            createdAt: serverTimestamp(),
            folderId: activeFolderId
        });
    } catch (e) {
        console.error("Error Firestore: ", e);
        throw e; // Re-lanzar para que lo capture el handler principal
    }
}


function resetUploaderUI() {
    progressContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
}

// --- 5. ACTIVITY LOG HELPER ---
async function logActivity(folderId, text, type = 'info') {
    try {
        await addDoc(collection(db, "folder_activities"), {
            folderId: folderId,
            text: text,
            type: type,
            timestamp: serverTimestamp(),
            user: auth.currentUser.displayName || auth.currentUser.email
        });
    } catch (e) {
        console.error("Error logging activity", e);
    }
}

// --- 5. LÓGICA TIEMPO REAL (Lectura) ---

function subscribeToFiles(folderId) {
    if (unsubscribeFiles) unsubscribeFiles();

    const q = query(collection(db, "files"), where("folderId", "==", folderId), orderBy("createdAt", "desc"));

    unsubscribeFiles = onSnapshot(q, (snapshot) => {
        filesList.innerHTML = '';

        const activeFiles = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id;
            // CLIENT SIDE FILTER for now to avoid specific "archived==false" index requirement on top of existing
            if (!data.archived) {
                activeFiles.push(data);
            }
        });

        if (activeFiles.length === 0) {
            filesList.innerHTML = '<p style="text-align:center; color:#94a3b8; margin-top:30px;"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom:10px; display:block; opacity:0.5;"></i>Carpeta vacía.</p>';
            return;
        }

        activeFiles.forEach(file => renderFileItem(file));
    });
}

function renderFileItem(file) {
    // Fecha relativa simple
    const dateOpts = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateStr = file.createdAt ? file.createdAt.toDate().toLocaleDateString('es-ES', dateOpts) : 'Procesando...';

    let iconClass = 'fa-file';
    let iconColor = '#6366f1'; // Default primary

    const type = file.type ? file.type.toLowerCase() : 'unknown';

    if (type === 'pdf') { iconClass = 'fa-file-pdf'; iconColor = '#ef4444'; }
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(type)) { iconClass = 'fa-file-image'; iconColor = '#d946ef'; }
    else if (['json', 'xml', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'xsl', 'xslt'].includes(type)) { iconClass = 'fa-file-code'; iconColor = '#22c55e'; }
    else if (['java'].includes(type)) { iconClass = 'fa-brands fa-java'; iconColor = '#f97316'; }
    else if (['sql'].includes(type)) { iconClass = 'fa-solid fa-database'; iconColor = '#eab308'; }
    else if (['txt', 'md', 'csv', 'log'].includes(type)) { iconClass = 'fa-file-lines'; iconColor = '#3b82f6'; }
    else if (['mp4', 'mov', 'avi', 'webm'].includes(type)) { iconClass = 'fa-file-video'; iconColor = '#f59e0b'; }
    else if (['mp3', 'wav', 'ogg'].includes(type)) { iconClass = 'fa-file-audio'; iconColor = '#f59e0b'; }
    else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) { iconClass = 'fa-file-zipper'; iconColor = '#64748b'; }
    else if (['doc', 'docx'].includes(type)) { iconClass = 'fa-file-word'; iconColor = '#2563eb'; }
    else if (['ppt', 'pptx'].includes(type)) { iconClass = 'fa-file-powerpoint'; iconColor = '#e11d48'; }

    // Create Container
    const itemEl = document.createElement('div');
    itemEl.className = 'file-item';

    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'file-icon';
    iconDiv.style.color = iconColor;
    iconDiv.style.background = `${iconColor}15`;
    iconDiv.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

    // Meta/Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'file-info';
    infoDiv.innerHTML = `
        <a href="${file.url}" target="_blank" class="file-title">${file.name}</a>
        <div class="file-details">
            <i class="fa-solid fa-user-astronaut" style="font-size:0.8rem; margin-right:4px;"></i>
            <span class="file-user">${file.uploadedBy}</span> • ${dateStr}
        </div>
    `;

    // OPTIONS BUTTON (3-dots)
    const btnOptions = document.createElement('button');
    btnOptions.className = 'btn-file-delete';
    btnOptions.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';

    // DROPDOWN MENU
    const menu = document.createElement('div');
    menu.className = 'file-options-menu hidden';

    let viewCodeBtnHtml = '';
    const codeExts = ['java', 'sql', 'xml', 'json', 'js', 'ts', 'html', 'css', 'txt', 'md', 'xsl', 'xslt', 'csv', 'py', 'c', 'cpp'];
    if (codeExts.includes(file.type)) {
        viewCodeBtnHtml = '<button class="btn-opt-view-code"><i class="fa-solid fa-code"></i> Ver Código</button>';
    }

    menu.innerHTML = `
        <button class="btn-opt-download"><i class="fa-solid fa-download"></i> Descargar</button>
        ${viewCodeBtnHtml}
        <button class="btn-opt-rename"><i class="fa-solid fa-pen"></i> Renombrar</button>
        ${file.type !== 'folder' ? '<button class="btn-opt-archive"><i class="fa-solid fa-box-archive"></i> Archivar</button>' : ''}
        <button class="btn-opt-move"><i class="fa-solid fa-share"></i> Mover</button>
        <div class="divider"></div>
        <button class="btn-opt-delete btn-file-delete"><i class="fa-solid fa-trash"></i> Eliminar</button>
    `;

    // Toggle Menu
    btnOptions.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other file menus AND remove z-active from others
        document.querySelectorAll('.file-options-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.file-item').forEach(i => i.classList.remove('z-active'));

        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
            itemEl.classList.add('z-active');
        } else {
            itemEl.classList.remove('z-active');
        }
    });

    // ACTION: VIEW CODE
    const btnViewCode = menu.querySelector('.btn-opt-view-code');
    if (btnViewCode) {
        btnViewCode.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
            itemEl.classList.remove('z-active');
            openCodeViewer(file);
        });
    }

    // ACTION: RENAME
    const btnRename = menu.querySelector('.btn-opt-rename');
    btnRename.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        itemEl.classList.remove('z-active');
        openFileRenameModal(file.id, file.name);
    });

    // ACTION: DOWNLOAD
    const btnDownload = menu.querySelector('.btn-opt-download');
    btnDownload.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        itemEl.classList.remove('z-active');
        window.open(file.url, '_blank');
    });

    // ACTION: ARCHIVE
    const btnArchive = menu.querySelector('.btn-opt-archive');
    btnArchive.addEventListener('click', async (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        itemEl.classList.remove('z-active');
        try {
            await updateDoc(doc(db, "files", file.id), { archived: true });
            await logActivity(activeFolderId, "archivó un elemento", "archive");
            showToast("Archivo archivado");
        } catch (error) {
            console.error("Error archivando:", error);
            showToast("Error al archivar", "error");
        }
    });

    // ACTION: MOVE
    const btnMove = menu.querySelector('.btn-opt-move');
    btnMove.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        itemEl.classList.remove('z-active');
        openMoveModal(file.id);
    });

    // ACTION: DELETE
    const btnDelete = menu.querySelector('.btn-opt-delete');
    btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        itemEl.classList.remove('z-active');
        openDeleteModal('file', file.id || file.name);
    });

    // Append All
    itemEl.appendChild(iconDiv);
    itemEl.appendChild(infoDiv);
    itemEl.appendChild(btnOptions);
    itemEl.appendChild(menu);

    filesList.appendChild(itemEl);
}

// --- 6. FOLDER MENU LOGIC ---

// Toggle Menu
if (btnFolderMenu) {
    btnFolderMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        folderMenuDropdown.classList.toggle('hidden');
    });
}

// Global Click to Close new menus
document.addEventListener('click', (e) => {
    // Close File Options
    if (!e.target.closest('.file-options-menu') && !e.target.closest('.btn-file-delete')) {
        document.querySelectorAll('.file-options-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.file-item').forEach(i => i.classList.remove('z-active'));
    }
    // Close Folder Menu
    if (folderMenuDropdown && !folderMenuDropdown.contains(e.target) && !btnFolderMenu.contains(e.target)) {
        folderMenuDropdown.classList.add('hidden');
    }
});

// 6.1 ARCHIVED FILES
if (btnMenuArchived) {
    btnMenuArchived.addEventListener('click', () => {
        folderMenuDropdown.classList.add('hidden');
        archivedModal.classList.remove('hidden');
        loadArchivedFiles();
    });
}
if (btnCloseArchived) btnCloseArchived.addEventListener('click', () => archivedModal.classList.add('hidden'));

async function loadArchivedFiles() {
    if (!activeFolderId) return;
    archivedList.innerHTML = '<div class="loading-spinner">Cargando...</div>';

    // Client-side filtering strategy (filtering the Main subscription is cleaner, but for a separate modal we usually fetch)
    const q = query(collection(db, "files"), where("folderId", "==", activeFolderId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q); // One-time fetch

    archivedList.innerHTML = '';
    const archived = [];
    snapshot.forEach(doc => {
        const d = doc.data();
        d.id = doc.id;
        if (d.archived) archived.push(d);
    });

    if (archived.length === 0) {
        archivedList.innerHTML = '<p class="empty-msg">No hay archivos archivados.</p>';
        return;
    }

    archived.forEach(file => {
        const el = document.createElement('div');
        el.className = 'archived-item';
        el.innerHTML = `
            <span>${file.name}</span>
            <div style="display:flex; gap:10px;">
                <button class="btn-text" onclick="restoreFile('${file.id}')">Restaurar</button>
            </div>
        `;
        archivedList.appendChild(el);
    });
}

window.restoreFile = async (fileId) => {
    try {
        await updateDoc(doc(db, "files", fileId), { archived: false });
        await logActivity(activeFolderId, "restauró un archivo", "archive");
        showToast("Archivo restaurado");
        loadArchivedFiles(); // Refresh list
    } catch (e) {
        console.error("Error restore:", e);
    }
};

// 6.2 ACTIVITY LOG
if (btnMenuActivity) {
    btnMenuActivity.addEventListener('click', () => {
        folderMenuDropdown.classList.add('hidden');
        activityModal.classList.remove('hidden');
        loadActivityLog();
    });
}
if (btnCloseActivity) btnCloseActivity.addEventListener('click', () => activityModal.classList.add('hidden'));

async function loadActivityLog() {
    if (!activeFolderId) return;
    activityList.innerHTML = '<div class="loading-spinner">Cargando actividad...</div>';

    const q = query(collection(db, "folder_activities"), where("folderId", "==", activeFolderId), orderBy("timestamp", "desc"), limit(20));

    onSnapshot(q, (snapshot) => { // Realtime log!
        activityList.innerHTML = '';
        if (snapshot.empty) {
            activityList.innerHTML = '<p class="empty-msg">No hay actividad reciente.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const act = doc.data();
            const dateStr = act.timestamp ? act.timestamp.toDate().toLocaleString() : 'Justo ahora';
            let icon = 'fa-info';
            if (act.type === 'upload') icon = 'fa-cloud-arrow-up';
            if (act.type === 'delete') icon = 'fa-trash';
            if (act.type === 'archive') icon = 'fa-box-archive';
            if (act.type === 'move') icon = 'fa-share';

            const el = document.createElement('div');
            el.className = 'activity-item';
            el.innerHTML = `
                <div class="activity-icon"><i class="fa-solid ${icon}"></i></div>
                <div class="activity-content">
                    <div class="activity-text"><strong>${act.user}</strong> ${act.text}</div>
                    <div class="activity-time">${dateStr}</div>
                </div>
            `;
            activityList.appendChild(el);
        });
    }, (error) => {
        // Handle ALL errors, including permissions
        console.error("Error reading activity log:", error);
        activityList.innerHTML = `<p class="empty-msg text-danger">Error: ${error.message} (Ver consola)</p>`;
    });
}

// 6.3 MEMBERS
if (btnMenuMembers) {
    btnMenuMembers.addEventListener('click', () => {
        folderMenuDropdown.classList.add('hidden');
        membersModal.classList.remove('hidden');
        loadFolderMembers();
    });
}
if (btnCloseMembers) btnCloseMembers.addEventListener('click', () => membersModal.classList.add('hidden'));
if (btnOpenInviteModal) btnOpenInviteModal.addEventListener('click', () => {
    membersModal.classList.add('hidden');
    inviteModal.classList.remove('hidden');
});

async function loadFolderMembers() {
    if (!activeFolderId) return;
    membersList.innerHTML = '<div class="loading-spinner">Cargando usuarios...</div>';

    // 1. Get folder members UIDs
    const fSnap = await getDoc(doc(db, "folders", activeFolderId));
    if (!fSnap.exists()) return;
    const memberUids = fSnap.data().members || [];

    membersList.innerHTML = '';

    // 2. Fetch details for each (Promise.all)
    for (const uid of memberUids) {
        // Fetch user profile from "users" collection
        let displayName = "Usuario Desconocido";
        let email = "";

        if (uid === auth.currentUser.uid) {
            displayName = auth.currentUser.displayName + " (Tú)";
        } else {
            try {
                const uSnap = await getDoc(doc(db, "users", uid));
                if (uSnap.exists()) {
                    displayName = uSnap.data().username || "Anon";
                    email = uSnap.data().email || "";
                } else {
                    displayName = "Usuario (Sin Perfil)";
                }
            } catch (e) {
                console.warn("Error leyendo perfil usuario (Posible permiso):", uid, e);
                displayName = "Miembro (Protegido)";
                email = "Info Privada";
            }
        }

        const el = document.createElement('div');
        el.className = 'archived-item'; // Reuse style
        el.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="activity-icon" style="background:var(--primary); color:white;">
                    ${displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div style="font-weight:bold;">${displayName}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${email}</div>
                </div>
            </div>
        `;
        membersList.appendChild(el);
    }
}

// 6.4 MOVE FILE LOGIC
if (btnCloseMove) btnCloseMove.addEventListener('click', () => moveFileModal.classList.add('hidden'));

// 6.5 RENAME FILE LOGIC
if (btnCloseRename) btnCloseRename.addEventListener('click', () => renameFileModal.classList.add('hidden'));

function openFileRenameModal(fileId, currentName) {
    fileToRenameId = fileId;
    renameFileInput.value = currentName;
    renameFileModal.classList.remove('hidden');
    renameFileInput.focus();
}

if (renameFileForm) {
    renameFileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = renameFileInput.value.trim();
        if (!newName || !fileToRenameId) return;

        try {
            await updateDoc(doc(db, "files", fileToRenameId), { name: newName });
            await logActivity(activeFolderId, `renombró el archivo a "${newName}"`, "info");
            showToast("Archivo renombrado con éxito");
            renameFileModal.classList.add('hidden');
            fileToRenameId = null;
        } catch (error) {
            console.error("Error rename:", error);
            showToast("Error al renombrar", 'error');
        }
    });
}

function openMoveModal(fileId) {
    fileToMoveId = fileId;
    moveFileModal.classList.remove('hidden');
    moveFoldersList.innerHTML = '';

    // Filter out current folder
    const targets = allFoldersCache.filter(f => f.id !== activeFolderId);

    if (targets.length === 0) {
        moveFoldersList.innerHTML = '<p class="empty-msg">No hay otras carpetas.</p>';
        return;
    }

    targets.forEach(f => {
        const el = document.createElement('div');
        el.className = 'move-folder-item';
        el.innerHTML = `<i class="fa-regular fa-folder"></i> ${f.name}`;
        el.addEventListener('click', async () => {
            // Move Execution
            try {
                await updateDoc(doc(db, "files", fileToMoveId), { folderId: f.id });
                await logActivity(activeFolderId, `movió un archivo a ${f.name}`, "move");
                await logActivity(f.id, `recibió un archivo`, "move");

                showToast("Archivo movido");
                moveFileModal.classList.add('hidden');
            } catch (e) {
                console.error("Error move:", e);
                showToast("Error al mover", 'error');
            }
        });
        moveFoldersList.appendChild(el);
    });
}

// 7. GOOGLE DRIVE INTEGRATION (PICKER API) ---

// Code Viewer Logic
const btnCopyCode = document.getElementById('btn-copy-code');

if (btnCloseCodeViewer) {
    btnCloseCodeViewer.addEventListener('click', () => {
        codeViewerModal.classList.add('hidden');
    });
}

if (btnCopyCode) {
    btnCopyCode.addEventListener('click', async () => {
        const code = codeViewerContent.textContent;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            const originalText = btnCopyCode.innerHTML;
            btnCopyCode.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
            setTimeout(() => {
                btnCopyCode.innerHTML = originalText;
            }, 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
            showToast('Error al copiar al portapapeles', 'error');
        }
    });
}

async function openCodeViewer(file) {
    codeViewerModal.classList.remove('hidden');
    codeViewerContent.textContent = "Cargando contenido...";

    try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error("No se pudo cargar el archivo");
        const text = await response.text();
        codeViewerContent.textContent = text;
    } catch (e) {
        codeViewerContent.textContent = "Error al cargar el archivo: " + e.message;
    }
}

const btnDriveUpload = document.getElementById('btn-drive-upload');
let tokenClient;
let accessToken = null;
let pickerInited = false;
let gisInited = false;

// 7.1 Load Google Scripts Dynamically
function loadGoogleDriveScripts() {
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.async = true;
    script1.defer = true;
    script1.onload = () => {
        gapi.load('picker', { callback: () => { pickerInited = true; } });
    };

    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.async = true;
    script2.defer = true;
    script2.onload = () => {
        gisInited = true;
        // Initialize Token Client
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '839228518206-tikeq82ccnkbvoovkm2av5pqf8kkjo1g.apps.googleusercontent.com', // Updated Client ID
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: '', // defined at request time
        });
    };

    document.body.appendChild(script1);
    document.body.appendChild(script2);
}

// 7.2 Trigger API Load
loadGoogleDriveScripts();

if (btnDriveUpload) {
    btnDriveUpload.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!pickerInited || !gisInited) {
            showToast("Conectando con Google... intenta en unos segundos.", 'warning');
            return;
        }
        handleDriveClick();
    });
}

function handleDriveClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        accessToken = resp.access_token;
        createPicker();
    };

    if (accessToken === null) {
        // Prompt the user for consent
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function createPicker() {
    if (!activeFolderId) {
        showToast("Selecciona una carpeta primero.", 'error');
        return;
    }

    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes("image/png,image/jpeg,image/jpg,application/pdf,text/plain,application/json,text/markdown,application/sql,text/x-sql,text/sql,text/x-java-source,text/x-java");

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setAppId("839228518206") // Numeric part of Client ID
        .setOAuthToken(accessToken)
        .addView(view)
        .setDeveloperKey(firebaseConfig.apiKey)
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
}

async function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const fileData = data.docs[0];
        const fileId = fileData[google.picker.Document.ID];
        const fileName = fileData[google.picker.Document.NAME];
        const mimeType = fileData[google.picker.Document.MIME_TYPE];

        showToast(`Descargando ${fileName} desde Drive...`, 'info');

        try {
            // 7.3 Fetch file content (Blob) using the Access Token
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) throw new Error("Error fetching file content from Drive");

            const blob = await response.blob();

            // Create a File object from the Blob
            const file = new File([blob], fileName, { type: mimeType });

            // 7.4 Upload to Firebase (Re-use existing logic)
            handleFileUpload(file);

        } catch (error) {
            console.error("Drive Fetch Error:", error);
            showToast("Error Drive: " + (error.message || error), 'error');
        }
    }
}
