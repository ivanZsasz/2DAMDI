// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCUnbVoalIGZ2PkE_yphvJDqY9fWizV6Sw",
    authDomain: "novelagraficaapp.firebaseapp.com",
    projectId: "novelagraficaapp",
    storageBucket: "novelagraficaapp.firebasestorage.app",
    messagingSenderId: "286173394229",
    appId: "1:286173394229:web:6eb683673a64178042487c"
};

// Initialize Firebase
let auth;
try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    window.db = getFirestore(app);
} catch (e) {
    console.error("Firebase initialization failed. Make sure to replace placeholders with valid config.", e);
}


// --- DATA ---
const comicsDB = []; // Data will be loaded from Firestore

// --- RENDERIZADO BÁSICO ---
function renderComics(data) {
    const grid = document.getElementById('mangaGrid');
    const resultsCount = document.getElementById('resultsCount');
    const emptyState = document.getElementById('emptyState');

    if (!grid) return;

    grid.innerHTML = '';
    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        resultsCount.innerText = "0";
    } else {
        emptyState.classList.add('hidden');
        resultsCount.innerText = data.length;
    }

    data.forEach(comic => {
        // Handle genre as array
        const genres = Array.isArray(comic.genre) ? comic.genre : [comic.genre];
        const isNSFW = genres.includes('sincensura');

        let badge = isNSFW ? 'bg-red-600' : 'bg-primary';
        let label = isNSFW ? '🔞 +18' : 'Manga'; // Fallback label

        // Display genres string
        const genreDisplay = genres.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ');

        const cardHTML = `
            <div class="manga-card bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group cursor-pointer" onclick="window.openReader('${comic.title}')">
                <div class="relative aspect-cover bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <span class="absolute top-2 left-2 ${badge} text-white text-xs px-2 py-1 rounded shadow-lg font-bold z-10">${label}</span>
                    <img src="${comic.cover}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                </div>
                <div class="p-4">
                    <h3 class="text-slate-900 dark:text-white font-bold truncate">${comic.title}</h3>
                    <div class="flex justify-between items-center text-xs text-slate-500 uppercase mt-1">
                        <span class="truncate max-w-[60%]">${genreDisplay}</span>
                        <span class="border border-slate-200 dark:border-slate-700 px-1 rounded">${comic.type}</span>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += cardHTML;
    });

    if (window.lucide) window.lucide.createIcons();
}

// --- FILTERS ---
window.applyFilters = function () {
    const genre = document.getElementById('genreFilter').value;
    const type = document.querySelector('input[name="type"]:checked').value;
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    const filtered = comicsDB.filter(comic => {
        const genres = Array.isArray(comic.genre) ? comic.genre : [comic.genre];

        const matchesGenre = genre === 'all' || genres.includes(genre);
        const matchesType = type === 'all' || comic.type === type;
        const matchesSearch = comic.title.toLowerCase().includes(searchText) || comic.author.toLowerCase().includes(searchText);

        return matchesGenre && matchesType && matchesSearch;
    });

    renderComics(filtered);
}

window.resetFilters = function () {
    document.getElementById('genreFilter').value = 'all';
    document.querySelector('input[name="type"][value="all"]').checked = true;
    document.getElementById('searchInput').value = '';
    renderComics(comicsDB);
}

// Search Input Listener
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // Optional: Debounce or just valid search
            window.applyFilters();
        });
    }
});

// --- AUTHENTICATION LOGIC ---

// Toggle between Login and Register views
window.toggleAuthMode = function () {
    const loginView = document.getElementById('loginView');
    const registerView = document.getElementById('registerView');
    const authError = document.getElementById('authError');

    if (loginView.classList.contains('hidden')) {
        loginView.classList.remove('hidden');
        registerView.classList.add('hidden');
    } else {
        loginView.classList.add('hidden');
        registerView.classList.remove('hidden');
    }
    authError.classList.add('hidden');
}

// Handle Google Login
async function handleGoogleLogin() {
    if (!auth) {
        showAuthError("Firebase no está configurado correctamente.");
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        closeModal('authModal');
    } catch (error) {
        console.error("Error Google login", error);
        showAuthError(translateFirebaseError(error.code));
    }
}

// Handle Email Login
async function handleEmailLogin(e) {
    e.preventDefault();
    if (!auth) {
        showAuthError("Firebase no está configurado correctamente.");
        return;
    }

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('authModal');
        document.getElementById('loginForm').reset();
    } catch (error) {
        console.error("Error Email login", error);
        showAuthError(translateFirebaseError(error.code));
    }
}

// Handle Register
async function handleRegister(e) {
    e.preventDefault();
    if (!auth) {
        showAuthError("Firebase no está configurado correctamente.");
        return;
    }

    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    if (password.length < 6) {
        showAuthError("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        closeModal('authModal');
        document.getElementById('registerForm').reset();
        // Optional: Send verification email here
    } catch (error) {
        console.error("Error Register", error);
        showAuthError(translateFirebaseError(error.code));
    }
}

function showAuthError(message) {
    const errorBox = document.getElementById('authError');
    errorBox.innerText = message;
    errorBox.classList.remove('hidden');
}

function translateFirebaseError(code) {
    switch (code) {
        case 'auth/email-already-in-use': return 'El correo ya está registrado.';
        case 'auth/invalid-email': return 'El correo no es válido.';
        case 'auth/weak-password': return 'La contraseña es muy débil.';
        case 'auth/user-not-found': return 'Usuario no encontrado.';
        case 'auth/wrong-password': return 'Contraseña incorrecta.';
        case 'auth/popup-closed-by-user': return 'Se cerró la ventana de inicio de sesión.';
        case 'auth/operation-not-allowed': return 'El inicio de sesión con Google no está habilitado en Firebase.';
        case 'auth/unauthorized-domain': return 'Este dominio no está autorizado en Firebase. Añádelo en Authentication > Settings > Authorized Domains.';
        default: return 'Ocurrió un error: ' + code;
    }
}

// Listen to Auth State Changes
function initAuthListener() {
    if (!auth) return;

    onAuthStateChanged(auth, (user) => {
        const authButtonContainer = document.querySelector('nav .flex.items-center.gap-3');
        // Find the "Acceder" button. It's the last child usually.
        // Better: let's re-render that part or manipulate DOM.

        if (user) {
            // User is signed in
            // Replace "Acceder" with User Profile / Logout
            // Check if we already have the logout button to avoid re-adding
            if (!document.getElementById('logoutBtn')) {
                const accessBtn = authButtonContainer.querySelector('button:last-child');
                if (accessBtn && accessBtn.innerText.includes('Acceder')) {
                    accessBtn.remove();
                }

                const userMenu = document.createElement('div');
                userMenu.id = 'userMenu';
                userMenu.className = 'flex items-center gap-3';
                userMenu.innerHTML = `
                    <div class="hidden sm:block text-right">
                        <p class="text-xs text-slate-500">Hola,</p>
                        <p class="text-sm font-bold text-slate-800 dark:text-white max-w-[100px] truncate">${user.displayName || user.email.split('@')[0]}</p>
                    </div>
                    <img src="${user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid}" class="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100">
                    <button id="logoutBtn" class="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-full transition-colors" title="Cerrar Sesión">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                    </button>
                `;
                authButtonContainer.appendChild(userMenu);

                // Re-init icons for the new logout button
                if (window.lucide) window.lucide.createIcons();

                // Add logout listener
                document.getElementById('logoutBtn').addEventListener('click', () => {
                    signOut(auth).then(() => {
                        // UI will update automatically via this listener
                    });
                });
            }
        } else {
            // User is signed out
            const userMenu = document.getElementById('userMenu');
            if (userMenu) {
                userMenu.remove();

                // Add back "Acceder" button
                const loginBtn = document.createElement('button');
                loginBtn.onclick = () => openModal('authModal');
                loginBtn.className = "bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg shadow-orange-500/20 transition-all";
                loginBtn.innerText = "Acceder";
                authButtonContainer.appendChild(loginBtn);
            }
        }
    });
}


// --- LÓGICA DEL EDITOR (INKSTUDIO) ---
let selectedElements = [];
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let isBoxSelecting = false;
let boxStart = { x: 0, y: 0 };
let selectionBox;
let canvas;
let imgElement;
let clipboard = [];

// --- MULTI-PAGE SYSTEM ---
let projectPages = []; // Array of { file: File, dataUrl: string, layers: Array }
let currentPageIndex = 0;

// --- HISTORY SYSTEM (Undo/Redo) ---
let historyStack = [];
let currentStep = -1;
const MAX_HISTORY = 50;

// Override handleImageUpload to support multiple files
window.handleImageUpload = function (event) {
    // Check Auth
    if (!auth.currentUser) {
        showNotification("Debes iniciar sesión para subir obras.", "error");
        event.target.value = ''; // Reset input to allow re-selection
        openModal('authModal');
        return;
    }

    const files = Array.from(event.target.files);
    if (!files.length) return;

    // Sort files by name to ensure correct order (page1, page2, etc.)
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    // Reset project
    projectPages = [];
    currentPageIndex = 0;
    historyStack = [];
    currentStep = -1;

    // Process all files
    let loadedCount = 0;
    files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            projectPages.push({
                id: Date.now() + Math.random(), // Ensure ID exists
                file: file,
                dataUrl: e.target.result,
                layers: [] // Store text layers here
            });
            loadedCount++;

            // When all files are loaded, render the first one (sorting again by file name might be needed if async finishes out of order, 
            // but for simplicity we rely on the initial sort and assume we can re-sort array based on file names)
            if (loadedCount === files.length) {
                // Ensure order is correct even if async loading was not
                projectPages.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' }));
                renderPage(0);
                updatePageControls();
            }
        }
        reader.readAsDataURL(file);
    });
}

function updatePageControls() {
    const controls = document.getElementById('pageControls');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const counter = document.getElementById('pageCounter');

    if (projectPages.length > 0) {
        controls.classList.remove('hidden');
        counter.innerText = `${currentPageIndex + 1} / ${projectPages.length}`;

        prevBtn.disabled = currentPageIndex === 0;
        nextBtn.disabled = currentPageIndex === projectPages.length - 1;

        prevBtn.style.opacity = prevBtn.disabled ? "0.5" : "1";
        nextBtn.style.opacity = nextBtn.disabled ? "0.5" : "1";
    } else {
        controls.classList.add('hidden');
    }
}

window.renderPage = function (index) {
    if (index < 0 || index >= projectPages.length) return;

    const canvasContainer = document.getElementById('editor-canvas');
    const placeholder = document.getElementById('canvas-placeholder');
    const img = document.getElementById('editor-image');

    // Clear current text layers from DOM
    const existingLayers = document.querySelectorAll('.draggable-text');
    existingLayers.forEach(el => el.remove());

    const pageData = projectPages[index];

    // Update Image
    img.src = pageData.dataUrl;
    img.classList.remove('hidden');
    placeholder.classList.add('hidden');

    // Restore Layers
    pageData.layers.forEach(layer => {
        const textDiv = document.createElement('div');
        textDiv.className = 'draggable-text absolute cursor-move p-2 border-2 border-transparent hover:border-blue-400 select-none';
        textDiv.contentEditable = true;
        textDiv.innerText = layer.text;

        // Restore styles
        Object.assign(textDiv.style, layer.style);

        // Restore custom properties if any (like data attributes)
        if (layer.dataset) {
            Object.keys(layer.dataset).forEach(key => {
                textDiv.dataset[key] = layer.dataset[key];
            });
        }

        // Add event listeners (assuming addInteractionEvents logic exists or we reuse the logic from addTextLayer)
        // Since original addTextLayer adds listeners, we need to extract that logic or replicate it.
        // For now, we'll manually re-attach the key listeners.
        textDiv.addEventListener('mousedown', handleTextMouseDown);
        textDiv.addEventListener('click', (e) => e.stopPropagation());

        // Re-apply special classes
        if (layer.classList) {
            layer.classList.forEach(c => textDiv.classList.add(c));
        }

        canvasContainer.appendChild(textDiv);
    });

    currentPageIndex = index;
    updatePageControls();
}

window.saveCurrentPageLogic = function () {
    if (projectPages.length === 0) return;

    const layersResult = Array.from(document.querySelectorAll('.draggable-text')).map(el => ({
        text: el.innerText,
        style: {
            left: el.style.left,
            top: el.style.top,
            fontSize: el.style.fontSize,
            color: el.style.color,
            fontFamily: el.style.fontFamily,
            backgroundColor: el.style.backgroundColor,
            width: el.style.width,
            height: el.style.height,
            transform: el.style.transform
        },
        dataset: { ...el.dataset },
        classList: Array.from(el.classList)
    }));

    const editorCanvas = document.getElementById('editor-canvas');

    projectPages[currentPageIndex].layers = layersResult;
    // Store reference dimensions for scaling later
    projectPages[currentPageIndex].width = editorCanvas.offsetWidth;
    projectPages[currentPageIndex].height = editorCanvas.offsetHeight;
}

window.prevPage = function () {
    if (currentPageIndex > 0) {
        saveCurrentPageLogic();
        renderPage(currentPageIndex - 1);
    }
}

window.nextPage = function () {
    if (currentPageIndex < projectPages.length - 1) {
        saveCurrentPageLogic();
        renderPage(currentPageIndex + 1);
    }
}

window.goToPublish = function () {
    saveCurrentPageLogic();
    if (projectPages.length === 0) {
        alert("Sube al menos una página.");
        return;
    }
    document.getElementById('publishPageCount').innerText = projectPages.length;
    closeModal('editorModal');
    openModal('publishModal');
}

// --- NOTIFICATION SYSTEM ---
window.showNotification = function (message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    // Icon based on type
    let icon = 'info';
    let colors = 'bg-white dark:bg-slate-800 border-l-4 border-blue-500 text-slate-800 dark:text-white';

    if (type === 'success') {
        icon = 'check-circle';
        colors = 'bg-white dark:bg-slate-800 border-l-4 border-green-500 text-slate-800 dark:text-white';
    } else if (type === 'error') {
        icon = 'alert-circle';
        colors = 'bg-white dark:bg-slate-800 border-l-4 border-red-500 text-slate-800 dark:text-white';
    }

    toast.className = `${colors} shadow-xl rounded-r-lg p-4 flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-auto min-w-[300px]`;
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-6 h-6"></i>
        <p class="text-sm font-medium">${message}</p>
    `;

    container.appendChild(toast);

    if (window.lucide) window.lucide.createIcons();

    // Animate In
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animate Out & Remove
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- COVER UPLOAD ---
let customCoverUrl = null;

window.handleCoverPreview = function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            customCoverUrl = e.target.result;
            const preview = document.getElementById('coverPreview');
            preview.src = customCoverUrl;
            preview.classList.remove('hidden');

            // Hide the placeholder content slightly or just keep it behind
            document.getElementById('coverPreviewContainer').style.opacity = '0';
        }
        reader.readAsDataURL(file);
    }
}

// Make function async to await Firestore
window.finishPublish = async function () {
    const title = document.getElementById('publishTitle').value;
    const typeRadio = document.querySelector('input[name="publishType"]:checked');
    const type = typeRadio ? typeRadio.value : 'manga';
    const genreCheckboxes = document.querySelectorAll('#publishGenreContainer input:checked');
    const selectedGenres = Array.from(genreCheckboxes).map(cb => cb.value);

    if (!title) {
        showNotification("Por favor escribe un título.", 'error');
        return;
    }

    if (selectedGenres.length === 0) {
        showNotification("Selecciona al menos un género.", 'error');
        return;
    }

    // Generate Cover if not uploaded
    let finalCoverUrl = customCoverUrl;
    if (!finalCoverUrl) {
        if (projectPages.length > 0) {
            finalCoverUrl = projectPages[0].dataUrl;
        } else {
            finalCoverUrl = 'https://placehold.co/600x800?text=No+Cover';
        }
    }

    try {
        // COMPRESS ASSETS
        showNotification("Comprimiendo imágenes...", "info");

        // DYNAMIC COMPRESSION HEURISTICS
        let targetQuality = 0.5;
        let targetWidth = 720;

        if (projectPages.length > 30) {
            targetQuality = 0.3;
            targetWidth = 450;
            showNotification(`Modo Ultra-Compresión activado (${projectPages.length} págs)`, "info");
        } else if (projectPages.length > 15) {
            targetQuality = 0.4;
            targetWidth = 600;
        }

        const compressedCover = await compressImage(finalCoverUrl, targetQuality, 600); // Cover always kept reasonable

        const compressedPages = await Promise.all(projectPages.map(async (page, index) => {
            return {
                id: page.id || Date.now() + index,
                // Use dynamic settings
                dataUrl: await flattenAndCompressPage(page, targetQuality, targetWidth) || 'https://placehold.co/600x800?text=Error'
            };
        }));

        const newComic = {
            title: title,
            author: auth.currentUser ? auth.currentUser.email : "Anónimo",
            genre: selectedGenres,
            type: type,
            chapters: compressedPages.length,
            status: "ongoing",
            cover: compressedCover,
            rating: 5.0,
            pages: compressedPages,
            createdAt: new Date().toISOString()
        };

        // Check payload size again
        const payloadSize = new Blob([JSON.stringify(newComic)]).size;
        console.log(`Compressed Payload: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);

        if (payloadSize > 950000) { // Safety margin < 1MB
            showNotification("Error: Aún comprimido, el cómic es muy grande. Reduce las páginas.", 'error');
            return;
        }

        // Save to Firestore
        const docRef = await addDoc(collection(window.db, "comics"), newComic);
        console.log("Document written with ID: ", docRef.id);

        showNotification(`¡Obra "${title}" publicada y comprimida!`, 'success');
        closeModal('publishModal');

        // Reset editor
        projectPages = [];
        document.getElementById('publishTitle').value = '';

        // Reset Cover
        customCoverUrl = null;
        document.getElementById('coverPreview').classList.add('hidden');
        document.getElementById('coverPreview').src = '';
        document.getElementById('coverPreviewContainer').style.opacity = '1';
        document.getElementById('publishCoverInput').value = '';

        // Uncheck genres
        document.querySelectorAll('#publishGenreContainer input').forEach(cb => cb.checked = false);

    } catch (e) {
        console.error("Error adding document: ", e);
        if (e.code === 'permission-denied') {
            showNotification("Error: Permisos denegados. Revisa la consola de Firebase.", 'error');
        } else {
            showNotification(`Error: ${e.message}`, 'error');
        }
    }
}

function saveHistory() {
    // Remove states ahead of current (if we did undo then new action)
    if (currentStep < historyStack.length - 1) {
        historyStack = historyStack.slice(0, currentStep + 1);
    }

    // Capture state
    const state = Array.from(document.querySelectorAll('.draggable-text')).map(el => ({
        text: el.innerText,
        style: {
            left: el.style.left,
            top: el.style.top,
            width: el.style.width,
            height: el.style.height,
            color: el.style.color,
            fontSize: el.style.fontSize,
            fontFamily: el.style.fontFamily,
            backgroundColor: el.style.backgroundColor,
            padding: el.style.padding,
            borderRadius: el.style.borderRadius,
            border: el.style.border,
        },
        groupId: el.dataset.groupId,
        isSelected: el.classList.contains('selected')
    }));

    historyStack.push(state);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    else currentStep++;
}

window.undo = function () {
    if (currentStep > 0) {
        currentStep--;
        loadState(historyStack[currentStep]);
    }
}

window.redo = function () {
    if (currentStep < historyStack.length - 1) {
        currentStep++;
        loadState(historyStack[currentStep]);
    }
}

function loadState(state) {
    // Clear Canvas
    const texts = document.querySelectorAll('.draggable-text');
    texts.forEach(el => el.remove());
    selectedElements = [];
    updateSelectionUI();

    if (!state) return;

    // Rebuild
    state.forEach(item => {
        const div = document.createElement('div');
        div.contentEditable = true;
        div.className = 'draggable-text';
        div.innerText = item.text;

        // Restore styles
        Object.assign(div.style, item.style);

        if (item.groupId) div.dataset.groupId = item.groupId;
        if (item.isSelected) {
            div.classList.add('selected');
            selectedElements.push(div);
        }

        div.ondragstart = function () { return false; };
        div.addEventListener('mousedown', (e) => handleTextMouseDown(e, div));

        canvas.appendChild(div);
    });
    updateSelectionUI();
}

// 1. Subir Imagen


// 2. Añadir Texto
window.addTextLayer = function () {
    if (document.getElementById('editor-image').classList.contains('hidden')) {
        alert("Primero sube una imagen para el fondo.");
        return;
    }

    const textDiv = document.createElement('div');
    textDiv.contentEditable = true;
    textDiv.className = 'draggable-text font-bangers text-2xl text-black';
    textDiv.innerText = "Texto Nuevo";
    textDiv.style.top = '20px';
    textDiv.style.left = '20px';
    textDiv.style.fontSize = '24px';
    textDiv.style.color = '#000000';

    textDiv.ondragstart = function () { return false; };
    textDiv.addEventListener('mousedown', (e) => handleTextMouseDown(e, textDiv));

    canvas.appendChild(textDiv);
    selectSingle(textDiv);
    saveHistory();
}

// 3. Manejo de Selección
function handleTextMouseDown(e, element) {
    e.stopPropagation();

    if (e.shiftKey) {
        toggleSelection(element);
    } else {
        if (!selectedElements.includes(element)) {
            selectSingle(element);
        }
    }

    isDragging = true;
    lastMousePos = { x: e.clientX, y: e.clientY };

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function selectSingle(element) {
    clearSelection();
    addToSelection(element);
}

function addToSelection(element) {
    if (!selectedElements.includes(element)) {
        selectedElements.push(element);
        element.classList.add('selected');
        updateSelectionUI();
    }
}

function toggleSelection(element) {
    if (selectedElements.includes(element)) {
        selectedElements = selectedElements.filter(el => el !== element);
        element.classList.remove('selected');
    } else {
        selectedElements.push(element);
        element.classList.add('selected');
    }
    updateSelectionUI();
}

function clearSelection() {
    selectedElements.forEach(el => el.classList.remove('selected'));
    selectedElements = [];
    updateSelectionUI();
}

function updateSelectionUI() {
    const controls = document.getElementById('textControls');
    const groupControls = document.getElementById('groupControls');

    if (selectedElements.length > 0) {
        controls.classList.remove('opacity-50', 'pointer-events-none');
        const first = selectedElements[0];
        document.getElementById('colorInput').value = rgbToHex(first.style.color || '#000000');
        document.getElementById('fontSizeInput').value = parseInt(first.style.fontSize) || 24;
        document.getElementById('bgCheckbox').checked = first.style.backgroundColor === 'white';
    } else {
        controls.classList.add('opacity-50', 'pointer-events-none');
    }

    const hasGroup = selectedElements.length > 1 || (selectedElements.length === 1 && selectedElements[0].dataset.groupId);
    if (hasGroup) {
        groupControls.classList.remove('hidden');
    } else {
        groupControls.classList.add('hidden');
    }
}

// 4. Arrastre
function drag(e) {
    if (!isDragging) return;
    e.preventDefault();

    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    lastMousePos = { x: e.clientX, y: e.clientY };

    const elementsToMove = new Set([...selectedElements]);
    selectedElements.forEach(el => {
        if (el.dataset.groupId) {
            document.querySelectorAll(`.draggable-text[data-group-id="${el.dataset.groupId}"]`)
                .forEach(mate => elementsToMove.add(mate));
        }
    });

    elementsToMove.forEach(el => {
        el.style.left = (el.offsetLeft + dx) + 'px';
        el.style.top = (el.offsetTop + dy) + 'px';
    });
}

function stopDrag() {
    if (isDragging) {
        saveHistory();
    }
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

// 5. Box Selection Logic
function initBoxSelection() {
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => {
        if (e.target !== canvas && e.target.id !== 'editor-image') return;
        if (!e.shiftKey) clearSelection();

        isBoxSelecting = true;
        const rect = canvas.getBoundingClientRect();
        boxStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        selectionBox.style.display = 'block';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
        selectionBox.style.left = boxStart.x + 'px';
        selectionBox.style.top = boxStart.y + 'px';

        document.addEventListener('mousemove', handleBoxMove);
        document.addEventListener('mouseup', handleBoxUp);
    });
}

function handleBoxMove(e) {
    if (!isBoxSelecting) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = Math.abs(currentX - boxStart.x);
    const height = Math.abs(currentY - boxStart.y);
    const left = Math.min(currentX, boxStart.x);
    const top = Math.min(currentY, boxStart.y);

    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
}

function handleBoxUp(e) {
    if (!isBoxSelecting) return;
    isBoxSelecting = false;

    // Medir ANTES de ocultar
    const boxRect = selectionBox.getBoundingClientRect();
    selectionBox.style.display = 'none';

    document.removeEventListener('mousemove', handleBoxMove);
    document.removeEventListener('mouseup', handleBoxUp);

    const texts = document.querySelectorAll('.draggable-text');

    texts.forEach(el => {
        const elRect = el.getBoundingClientRect();
        if (isOverlapping(boxRect, elRect)) {
            addToSelection(el);
        }
    });
}

function isOverlapping(rect1, rect2) {
    return !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
}

// 6. Funciones de Agrupación
window.groupSelected = function () {
    if (selectedElements.length < 2) return;
    const groupId = 'group-' + Date.now();
    selectedElements.forEach(el => { el.dataset.groupId = groupId; });
    const temp = [...selectedElements];
    clearSelection();
    temp.forEach(el => addToSelection(el));
    saveHistory();
}

window.ungroupSelected = function () {
    selectedElements.forEach(el => { delete el.dataset.groupId; });
    const temp = [...selectedElements];
    clearSelection();
    temp.forEach(el => addToSelection(el));
    saveHistory();
}

// 7. Styles Utilities
window.updateSelectedText = function (property, value) {
    selectedElements.forEach(el => { el.style[property] = value; });
    saveHistory();
}
window.toggleTextBackground = function (checked) {
    selectedElements.forEach(el => { if (checked) { el.style.backgroundColor = 'white'; el.style.padding = '5px 10px'; el.style.borderRadius = '8px'; } else { el.style.backgroundColor = 'transparent'; el.style.padding = '4px'; } });
    saveHistory();
}
window.deleteSelectedText = function () {
    selectedElements.forEach(el => el.remove());
    clearSelection();
    saveHistory();
}
function rgbToHex(rgb) { if (!rgb) return '#000000'; if (rgb.startsWith('#')) return rgb; return '#000000'; }

// 8. Atajos de Teclado
function handleShortcuts(e) {
    const isControl = e.ctrlKey || e.metaKey;

    // Delete / Supr / Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const isEditing = document.activeElement.isContentEditable;
        if (selectedElements.length > 0 && !isEditing) {
            deleteSelectedText();
        }
    }

    // Copiar (Ctrl+C)
    if (isControl && e.key.toLowerCase() === 'c') {
        if (selectedElements.length > 0) {
            copySelection();
        }
    }

    // Cortar (Ctrl+X)
    if (isControl && e.key.toLowerCase() === 'x') {
        if (selectedElements.length > 0) {
            copySelection();
            deleteSelectedText();
        }
    }

    // Pegar (Ctrl+V)
    if (isControl && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
            pasteSelection();
        }
    }

    // Undo (Ctrl+Z)
    if (isControl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }

    // Redo (Ctrl+Y or Ctrl+Shift+Z)
    if ((isControl && e.key.toLowerCase() === 'y') || (isControl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
    }
}

function copySelection() {
    clipboard = selectedElements.map(el => {
        return {
            text: el.innerText,
            style: {
                left: el.style.left,
                top: el.style.top,
                color: el.style.color,
                fontSize: el.style.fontSize,
                fontFamily: el.style.fontFamily,
                backgroundColor: el.style.backgroundColor,
                padding: el.style.padding,
                borderRadius: el.style.borderRadius,
            },
            groupId: el.dataset.groupId
        };
    });
}

function pasteSelection() {
    clearSelection();
    const groupMap = {};

    clipboard.forEach(item => {
        const div = document.createElement('div');
        div.contentEditable = true;
        div.className = 'draggable-text';
        div.innerText = item.text;

        // Offset
        const originalLeft = parseInt(item.style.left);
        const originalTop = parseInt(item.style.top);
        div.style.left = (originalLeft + 20) + 'px';
        div.style.top = (originalTop + 20) + 'px';

        div.style.color = item.style.color;
        div.style.fontSize = item.style.fontSize;
        div.style.fontFamily = item.style.fontFamily;
        div.style.backgroundColor = item.style.backgroundColor;
        div.style.padding = item.style.padding;
        div.style.borderRadius = item.style.borderRadius;

        // Group management
        if (item.groupId) {
            if (!groupMap[item.groupId]) {
                groupMap[item.groupId] = 'group-' + Date.now() + Math.random();
            }
            div.dataset.groupId = groupMap[item.groupId];
        }

        div.ondragstart = function () { return false; };
        div.addEventListener('mousedown', (e) => handleTextMouseDown(e, div));

        canvas.appendChild(div);
        addToSelection(div);
    });
    saveHistory();
}


// --- HELPER DE COMPRESIÓN ---
async function compressImage(dataUrl, quality = 0.5, maxWidth = 720) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL('image/webp', quality));
        };
        img.onerror = () => {
            console.error("Image compression failed");
            resolve(null);
        };
    });
}

// Flatten text layers onto image and compress
async function flattenAndCompressPage(page, quality = 0.5, maxWidth = 720) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = page.dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const originalWidth = width;

            // Scale down if needed for final output
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Draw Image
            ctx.drawImage(img, 0, 0, width, height);

            // Draw Custom Text Layers
            if (page.layers && page.layers.length > 0) {
                // Determine scale factor: (Final Image Width / Editor Width on Screen)
                // If page.width is undefined (old draft), assume 1 or standard width. 
                // However, without saved dimensions, positioning might be off if aspect ratio changed.
                // We'll trust page.width or fallback to width.
                const editorWidth = page.width || width;
                const editorHeight = page.height || height;

                const scaleX = width / editorWidth;
                const scaleY = height / editorHeight;

                page.layers.forEach(layer => {
                    const style = layer.style;

                    // Parse position
                    const left = parseFloat(style.left) || 0;
                    const top = parseFloat(style.top) || 0;

                    // Parse font size
                    const fontSize = parseFloat(style.fontSize) || 16;

                    // Apply Scale
                    const x = left * scaleX;
                    const y = top * scaleY;
                    const scaledFontSize = fontSize * scaleX;

                    // Setup Context
                    ctx.fillStyle = style.color || 'black';
                    ctx.font = `${scaledFontSize}px ${style.fontFamily || 'Arial'}`;
                    ctx.textBaseline = 'top';

                    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
                        // Background rect logic could be added here if needed, 
                        // but strictly "burning" text is usually just the text.
                        // If user used "background toggle", we should draw a rect.
                        const padding = 5 * scaleX; // Approx padding scaling
                        const textWidth = ctx.measureText(layer.text).width;
                        const textHeight = scaledFontSize * 1.2; // Approx line height

                        ctx.fillStyle = style.backgroundColor;
                        // Manual rect drawing if background exists
                        ctx.fillRect(x - padding, y - padding, textWidth + (padding * 2), textHeight + (padding * 2));

                        // Reset fill for text
                        ctx.fillStyle = style.color || 'black';
                    }

                    // Handle multiline logic if we supported <br>, but we use innerText mostly.
                    // Simple fillText for now.
                    // y-adjustment: 
                    // HTML text usually has some padding/line-height. 
                    // We might need a small offset to match visual exactness.
                    // For now, drawing at x,y is a good first step.
                    ctx.fillText(layer.text, x, y);
                });
            }

            resolve(canvas.toDataURL('image/webp', quality));
        };
        img.onerror = () => {
            console.error("Flattening: Image load failed");
            resolve(null);
        };
    });
}

// --- UTILS ---
window.toggleTheme = function () {
    document.documentElement.classList.toggle('dark');
}

window.openModal = function (id) {
    document.getElementById(id).classList.remove('hidden-modal');
    document.getElementById(id).classList.add('visible-modal');
    document.body.style.overflow = 'hidden';
}

window.closeModal = function (id) {
    document.getElementById(id).classList.remove('visible-modal');
    document.getElementById(id).classList.add('hidden-modal');
    document.body.style.overflow = '';
}

// --- READER LOGIC ---
let currentReaderIndex = 0;
let currentReaderPages = [];

window.openReader = function (title) {
    const comic = comicsDB.find(c => c.title === title);
    if (!comic) return;

    document.getElementById('readerTitle').innerText = comic.title;

    // Store pages and reset index
    currentReaderPages = comic.pages || [];
    currentReaderIndex = 0;

    const readerContainer = document.querySelector('#readerModal .flex-1');
    readerContainer.innerHTML = '';
    readerContainer.classList.remove('items-center', 'justify-center', 'overflow-y-auto');
    readerContainer.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'relative', 'bg-slate-900', 'h-full');

    if (currentReaderPages.length > 0) {
        // Inject Reader Controls & Image Container
        readerContainer.innerHTML = `
            <div class="relative w-full h-full flex items-center justify-center p-4">
                <!-- Image -->
                <img id="readerImage" class="max-w-full max-h-full object-contain rounded shadow-2xl transition-opacity duration-300" />
                
                <!-- Controls Overlay (Hidden on mobile, visible on hover desktop) -->
                <button onclick="prevReaderPage()" class="absolute left-4 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm transition-all z-20">
                    <i data-lucide="chevron-left" class="w-8 h-8"></i>
                </button>
                <button onclick="nextReaderPage()" class="absolute right-4 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm transition-all z-20">
                    <i data-lucide="chevron-right" class="w-8 h-8"></i>
                </button>

                <!-- Page Counter -->
                <div class="absolute bottom-4 bg-black/70 text-white px-4 py-1 rounded-full text-sm font-bold backdrop-blur-md">
                    <span id="readerCounter">1 / ${currentReaderPages.length}</span>
                </div>
            </div>
        `;

        renderReaderPage(0);

    } else {
        // Placeholder
        readerContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-slate-500">
                <i data-lucide="book-open" class="w-16 h-16 mb-4 opacity-20"></i>
                <p>Sin páginas disponibles.</p>
            </div>
        `;
    }

    if (window.lucide) window.lucide.createIcons();
    openModal('readerModal');
}

window.renderReaderPage = function (index) {
    if (index < 0 || index >= currentReaderPages.length) return;

    const img = document.getElementById('readerImage');
    const counter = document.getElementById('readerCounter');

    // Fade out effect
    img.style.opacity = '0.5';

    setTimeout(() => {
        img.src = currentReaderPages[index].dataUrl;
        img.style.opacity = '1';
        counter.innerText = `${index + 1} / ${currentReaderPages.length}`;
    }, 150);

    currentReaderIndex = index;
}

window.nextReaderPage = function () {
    if (currentReaderIndex < currentReaderPages.length - 1) {
        renderReaderPage(currentReaderIndex + 1);
    } else {
        closeModal('readerModal');
    }
}

window.prevReaderPage = function () {
    if (currentReaderIndex > 0) {
        renderReaderPage(currentReaderIndex - 1);
    }
}

function handleReaderKeys(e) {
    if (document.getElementById('readerModal').classList.contains('hidden-modal')) return;

    if (e.key === 'ArrowRight') nextReaderPage();
    if (e.key === 'ArrowLeft') prevReaderPage();
    if (e.key === 'Escape') closeModal('readerModal');
}

// Init
canvas = document.getElementById('editor-canvas');
selectionBox = document.getElementById('selection-box');

if (window.lucide) window.lucide.createIcons();
// renderComics(comicsDB); // Removed initial render, waiting for Firestore

initBoxSelection();
initAuthListener();

// Listener Global de Teclado
// Listener Global de Teclado
document.addEventListener('keydown', handleShortcuts);
document.addEventListener('keydown', handleReaderKeys);

// Auth Listeners
document.getElementById('googleLoginBtn').addEventListener('click', handleGoogleLogin);
document.getElementById('loginForm').addEventListener('submit', handleEmailLogin);
document.getElementById('registerForm').addEventListener('submit', handleRegister);

// --- FIRESTORE LISTENER ---
const q = query(collection(window.db, "comics"), orderBy("createdAt", "desc"));
onSnapshot(q, (querySnapshot) => {
    // Clear local array and refill
    comicsDB.length = 0;
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Ensure ID is from doc.id if not present, though we used Date.now before.
        // Best to use Firestore ID or keep consistent.
        comicsDB.push({ ...data, id: doc.id });
    });

    console.log("Loaded comics from Firestore:", comicsDB.length);
    renderComics(comicsDB);
});
