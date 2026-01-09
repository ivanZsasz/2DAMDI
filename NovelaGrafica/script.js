// --- DATA ---
const comicsDB = [
    { id: 1, title: "Cyber Ronin", author: "Kairo Art", genre: "scifi", chapters: 12, status: "ongoing", cover: "https://images.unsplash.com/photo-1614726365723-49cfae92782f?q=80&w=600&auto=format&fit=crop", rating: 4.8 },
    { id: 2, title: "El Último Hechizo", author: "Ana M.", genre: "fantasia", chapters: 65, status: "completed", cover: "https://images.unsplash.com/photo-1601332069884-3b4e3f89f783?q=80&w=600&auto=format&fit=crop", rating: 4.5 },
    { id: 9, title: "Noches Prohibidas", author: "Secret X", genre: "sincensura", chapters: 15, status: "ongoing", cover: "https://images.unsplash.com/photo-1594361487118-f4e2b2288781?q=80&w=600&auto=format&fit=crop", rating: 4.9 },
];

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
        let badge = comic.genre === 'sincensura' ? 'bg-red-600' : 'bg-primary';
        let label = comic.genre === 'sincensura' ? '🔞 +18' : 'Manga';

        grid.innerHTML += `
            <div class="manga-card bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group cursor-pointer" onclick="openReader('${comic.title}')">
                <div class="relative aspect-cover bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <span class="absolute top-2 left-2 ${badge} text-white text-xs px-2 py-1 rounded shadow-lg font-bold z-10">${label}</span>
                    <img src="${comic.cover}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                </div>
                <div class="p-4">
                    <h3 class="text-slate-900 dark:text-white font-bold truncate">${comic.title}</h3>
                    <p class="text-xs text-slate-500 uppercase">${comic.genre}</p>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
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
// --- HISTORY SYSTEM (Undo/Redo) ---
let historyStack = [];
let currentStep = -1;
const MAX_HISTORY = 50;

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
        // Save selection state? For now, let's just save content.
        // We could save selected state to restore it.
        isSelected: el.classList.contains('selected')
    }));

    historyStack.push(state);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    else currentStep++;

    // console.log("State Saved. Step:", currentStep, "Stack:", historyStack.length);
}

function undo() {
    if (currentStep > 0) {
        currentStep--;
        loadState(historyStack[currentStep]);
    }
}

function redo() {
    if (currentStep < historyStack.length - 1) {
        currentStep++;
        loadState(historyStack[currentStep]);
    }
}

function loadState(state) {
    // Clear Canvas
    const texts = document.querySelectorAll('.draggable-text');
    texts.forEach(el => el.remove());
    selectedElements = []; // Reset selection to avoid leaks
    updateSelectionUI();

    // Rebuild
    state.forEach(item => {
        const div = document.createElement('div');
        div.contentEditable = true;
        div.className = 'draggable-text';
        div.innerText = item.text;

        // Restore styles
        Object.assign(div.style, item.style);

        if (item.groupId) div.dataset.groupId = item.groupId;
        // Restore specific class if needed, checking style border
        if (item.isSelected) {
            // Optional: restore selection. For robustness, let's select it.
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
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('editor-image');
            img.src = e.target.result;
            img.classList.remove('hidden');
            document.getElementById('canvas-placeholder').classList.add('hidden');
            canvas.style.width = 'fit-content';

            // Initial History State
            historyStack = [];
            currentStep = -1;
            saveHistory(); // Blank state (or with previous texts if any)
        }
        reader.readAsDataURL(file);
    }
}

// 2. Añadir Texto
function addTextLayer() {
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
    saveHistory(); // Save after add
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
        // Only save if actually dragged? For simplicity, save on any mouseup after drag start
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
function groupSelected() {
    if (selectedElements.length < 2) return;
    const groupId = 'group-' + Date.now();
    selectedElements.forEach(el => { el.dataset.groupId = groupId; });
    const temp = [...selectedElements];
    clearSelection();
    temp.forEach(el => addToSelection(el));
    saveHistory();
}

function ungroupSelected() {
    selectedElements.forEach(el => { delete el.dataset.groupId; });
    const temp = [...selectedElements];
    clearSelection();
    temp.forEach(el => addToSelection(el));
    saveHistory();
}

// 7. Styles Utilities
function updateSelectedText(property, value) {
    selectedElements.forEach(el => { el.style[property] = value; });
    saveHistory();
}
function toggleTextBackground(checked) {
    selectedElements.forEach(el => { if (checked) { el.style.backgroundColor = 'white'; el.style.padding = '5px 10px'; el.style.borderRadius = '8px'; } else { el.style.backgroundColor = 'transparent'; el.style.padding = '4px'; } });
    saveHistory();
}
function deleteSelectedText() {
    selectedElements.forEach(el => el.remove());
    clearSelection();
    saveHistory();
}
function rgbToHex(rgb) { if (!rgb) return '#000000'; if (rgb.startsWith('#')) return rgb; return '#000000'; }

// 8. Atajos de Teclado
function handleShortcuts(e) {
    const isControl = e.ctrlKey || e.metaKey; // Ctrl (Win) o Cmd (Mac)

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
            pasteSelection(); // pasteSelection should call saveHistory itself inside
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
    // Si copiamos un grupo, necesitamos regenerar el ID al pegar, así que copiamos la estructura
    // pero al pegar reasignaremos un nuevo GroupID para la copia.
}

function pasteSelection() {
    clearSelection();
    // Mapa para mapear viejos groupIds a nuevos para mantener la consistencia en el pegado
    const groupMap = {};

    clipboard.forEach(item => {
        const div = document.createElement('div');
        div.contentEditable = true;
        div.className = 'draggable-text';
        div.innerText = item.text;

        // Offset para que no se pegue encima
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

        // Gestión de Grupos
        if (item.groupId) {
            if (!groupMap[item.groupId]) {
                groupMap[item.groupId] = 'group-' + Date.now() + Math.random(); // Nuevo ID único
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


// --- UTILS ---
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden-modal');
    document.getElementById(id).classList.add('visible-modal');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('visible-modal');
    document.getElementById(id).classList.add('hidden-modal');
    document.body.style.overflow = '';
}

function openReader(title) {
    document.getElementById('readerTitle').innerText = title;
    openModal('readerModal');
}

// Init
window.onload = () => {
    canvas = document.getElementById('editor-canvas');
    selectionBox = document.getElementById('selection-box');

    lucide.createIcons();
    renderComics(comicsDB);
    initBoxSelection();

    // Listener Global de Teclado
    document.addEventListener('keydown', handleShortcuts);
}
