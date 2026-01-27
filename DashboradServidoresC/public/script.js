/**
 * Centro de Control Global - Fixed & Optimized
 */

const CONFIG = {
    // CAMBIO IMPORTANTE: Ponemos la dirección explícita del backend
    API_BASE: 'http://localhost:3000',
    REFRESH_INTERVAL: 1000,
    CHART_MAX_POINTS: 20,
    SERVERS: {
        '1': { timezone: 'Europe/Madrid', city: 'Madrid', region: 'europa' },
        '2': { timezone: 'Europe/Oslo', city: 'Oslo', region: 'europa' },
        '3': { timezone: 'Asia/Shanghai', city: 'Beijing', region: 'asia' },
        '4': { timezone: 'America/Bogota', city: 'Bogotá', region: 'america' }
    }
};

const state = {
    servers: {},
    charts: {},
    chartData: {},
    theme: localStorage.getItem('theme') || 'dark',
    stressActive: {},
    pendingAction: {}
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    Object.keys(CONFIG.SERVERS).forEach(id => {
        state.servers[id] = { status: 'offline' };
        state.chartData[id] = { labels: [], ramData: [], cpuData: [] };
        state.stressActive[id] = false;
    });

    applyTheme(state.theme);
    initializeCharts();
    updateAllClocks();

    // Relojes: Se actualizan cada segundo
    setInterval(updateAllClocks, 1000);

    // Datos: Primera carga inmediata y luego bucle
    updateAllServers();
    setInterval(updateAllServers, CONFIG.REFRESH_INTERVAL);

    console.log('🌐 Centro de Control Global v2.1 - Ready');
});

// ==================== THEME ====================
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    localStorage.setItem('theme', state.theme);
}

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ==================== FILTERS ====================
function filterServers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;
    const region = document.getElementById('filterRegion').value;

    document.querySelectorAll('.server-card').forEach(card => {
        const id = card.dataset.serverId;
        const serverConfig = CONFIG.SERVERS[id];
        const serverState = state.servers[id];
        const name = card.querySelector('.server-name')?.textContent.toLowerCase() || '';

        let visible = true;

        if (search && !name.includes(search)) visible = false;

        if (status !== 'all') {
            if (status === 'online' && serverState?.status !== 'online') visible = false;
            if (status === 'offline' && serverState?.status === 'online') visible = false;
        }

        if (region !== 'all' && serverConfig?.region !== region) visible = false;

        card.classList.toggle('hidden', !visible);
    });
}

function updateSummaryCount() {
    let online = 0, offline = 0;
    Object.values(state.servers).forEach(s => {
        if (s.status === 'online') online++; else offline++;
    });
    const onlineEl = document.getElementById('onlineCount');
    const offlineEl = document.getElementById('offlineCount');
    if (onlineEl) onlineEl.textContent = online;
    if (offlineEl) offlineEl.textContent = offline;
}

// ==================== CLOCKS ====================
function updateAllClocks() {
    // Reloj UTC Maestro
    const utcClock = document.getElementById('utcClock');
    if (utcClock) {
        utcClock.textContent = new Intl.DateTimeFormat('es-ES', {
            timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(new Date());
    }
    // Relojes Individuales
    Object.entries(CONFIG.SERVERS).forEach(([id, cfg]) => {
        const el = document.getElementById(`clock-${id}`);
        if (el) {
            el.textContent = new Intl.DateTimeFormat('es-ES', {
                timeZone: cfg.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            }).format(new Date());
        }
    });
}

// ==================== CHARTS ====================
function initializeCharts() {
    Object.keys(CONFIG.SERVERS).forEach(id => {
        const ctx = document.getElementById(`chart-${id}`);
        if (!ctx) return;

        state.charts[id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'RAM',
                        data: [],
                        borderColor: '#00f0ff',
                        backgroundColor: 'rgba(0,240,255,0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'CPU',
                        data: [],
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0,255,136,0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Desactivar animación para máxima velocidad
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#8899b3', font: { size: 9 }, boxWidth: 10 } }
                },
                scales: {
                    x: { display: false },
                    y: {
                        display: true,
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(136,153,179,0.1)' },
                        ticks: { color: '#556680', font: { size: 9 }, stepSize: 50, callback: v => v + '%' }
                    }
                }
            }
        });
    });
}

function updateChart(id, ram, cpu) {
    const chart = state.charts[id], data = state.chartData[id];
    if (!chart || !data) return;

    // Solo guardamos la hora si cambia para no saturar, pero empujamos datos siempre
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    data.labels.push(time);
    data.ramData.push(ram);
    data.cpuData.push(cpu);

    if (data.labels.length > CONFIG.CHART_MAX_POINTS) {
        data.labels.shift();
        data.ramData.shift();
        data.cpuData.shift();
    }

    chart.data.labels = data.labels;
    chart.data.datasets[0].data = data.ramData;
    chart.data.datasets[1].data = data.cpuData;
    chart.update();
}

function clearChart(id) {
    const data = state.chartData[id];
    if (data) { data.labels = []; data.ramData = []; data.cpuData = []; }
    const chart = state.charts[id];
    if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.data.datasets[1].data = [];
        chart.update();
    }
}

// ==================== API ACTIONS ====================

async function fetchServerStats(id) {
    try {
        const r = await fetch(`${CONFIG.API_BASE}/api/server/${id}/stats`);
        return await r.json();
    } catch { return { status: 'offline' }; }
}

async function startServer(id) {
    if (state.pendingAction[id]) return;
    state.pendingAction[id] = 'starting';

    const btnStart = document.getElementById(`btn-start-${id}`);
    if (btnStart) btnStart.disabled = true;

    // MENSAJE PERSONALIZADO
    const cityName = CONFIG.SERVERS[id].city;
    showToast('info', `🚀 Iniciando Servidor de ${cityName}...`);

    try {
        const r = await fetch(`${CONFIG.API_BASE}/api/server/${id}/start`, { method: 'POST' });
        const d = await r.json();

        if (d.success) {
            showToast('success', `✅ Servidor de ${cityName} iniciado`);
            // Desbloqueamos inmediatamente para ver el cambio rápido
            state.pendingAction[id] = null;
            // Forzamos actualización ya
            updateServerStats(id);
        } else {
            showToast('error', d.error);
            state.pendingAction[id] = null;
        }
    } catch {
        showToast('error', 'Error de conexión');
        state.pendingAction[id] = null;
    }
}

async function stopServer(id) {
    if (state.pendingAction[id]) return;
    state.pendingAction[id] = 'stopping';

    const btnStop = document.getElementById(`btn-stop-${id}`);
    if (btnStop) btnStop.disabled = true;

    const cityName = CONFIG.SERVERS[id].city;
    showToast('warning', `🛑 Apagando Servidor de ${cityName}...`);

    try {
        const r = await fetch(`${CONFIG.API_BASE}/api/server/${id}/stop`, { method: 'POST' });
        const d = await r.json();

        if (d.success) {
            showToast('success', `💤 Servidor de ${cityName} apagado`);
            state.servers[id] = { status: 'offline' };
            clearChart(id);

            // Damos 1 segundo para que multipass procese y luego liberamos
            setTimeout(() => {
                state.pendingAction[id] = null;
                updateServerUI(id, { status: 'offline' });
            }, 1000);
        } else {
            showToast('error', d.error);
            state.pendingAction[id] = null;
        }
    } catch {
        showToast('error', 'Error de conexión');
        state.pendingAction[id] = null;
    }
}

async function stressTest(id) {
    if (state.servers[id]?.status !== 'online') {
        showToast('error', '¡El servidor está apagado!');
        return;
    }
    if (state.stressActive[id]) return;

    const btn = document.getElementById(`btn-stress-${id}`);
    const card = document.querySelector(`[data-server-id="${id}"]`);
    const cityName = CONFIG.SERVERS[id].city;

    state.stressActive[id] = true;
    if (btn) btn.classList.add('loading');
    if (card) card.classList.add('stress-active');

    showToast('warning', `🔥 Sobrecargando CPU en ${cityName} (10s)...`);

    try {
        // No esperamos (await) para no bloquear la UI
        fetch(`${CONFIG.API_BASE}/api/server/${id}/stress`, { method: 'POST' });
    } catch { /* ignore */ }

    // Quitamos el efecto visual a los 10 segundos
    setTimeout(() => {
        state.stressActive[id] = false;
        if (btn) btn.classList.remove('loading');
        if (card) card.classList.remove('stress-active');
        showToast('success', `✅ Test en ${cityName} finalizado`);
    }, 10000);
}

// ==================== UPDATE LOOPS ====================
async function updateAllServers() {
    // Usamos map para lanzar todas las peticiones en paralelo
    await Promise.all(Object.keys(CONFIG.SERVERS).map(id => updateServerStats(id)));
    updateSummaryCount();
    filterServers(); // Re-aplicar filtros si cambia estado
}

async function updateServerStats(id) {
    // Si estamos encendiendo/apagando, no actualizamos para evitar saltos visuales raros
    if (state.pendingAction[id]) return;

    const data = await fetchServerStats(id);
    updateServerUI(id, data);

    // Actualizar gráfica si está online
    if (data.status === 'online' && data.memory && data.cpu) {
        updateChart(id, data.memory.percentage || 0, data.cpu.usage || 0);
    } else {
        // Si se apagó externamente, limpiar gráfica suavemente (opcional)
        updateChart(id, 0, 0);
    }
}

function updateServerUI(id, data) {
    const isOnline = data.status === 'online';
    state.servers[id].status = data.status;

    const indicator = document.getElementById(`status-${id}`);
    const badge = document.getElementById(`badge-${id}`);
    const ramVal = document.getElementById(`ram-value-${id}`);
    const ramDet = document.getElementById(`ram-details-${id}`);
    const cpuVal = document.getElementById(`cpu-value-${id}`);

    // Botones
    const btnStart = document.getElementById(`btn-start-${id}`);
    const btnStop = document.getElementById(`btn-stop-${id}`);
    const btnStress = document.getElementById(`btn-stress-${id}`);

    // Clases CSS
    if (indicator) {
        indicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
    }
    if (badge) {
        badge.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
        badge.className = `status-badge ${isOnline ? 'online' : 'offline'}`;
    }

    // Valores
    if (isOnline && data.memory) {
        if (ramVal) ramVal.textContent = data.memory.percentage;
        if (ramDet) ramDet.textContent = `${data.memory.used} / ${data.memory.total} MB`;
    } else {
        if (ramVal) ramVal.textContent = '--';
        if (ramDet) ramDet.textContent = '-- / -- MB';
    }

    if (isOnline && data.cpu) {
        if (cpuVal) cpuVal.textContent = data.cpu.usage;
    } else {
        if (cpuVal) cpuVal.textContent = '--';
    }

    // Estado de botones
    if (btnStart) btnStart.disabled = isOnline;
    if (btnStop) btnStop.disabled = !isOnline;
    if (btnStress) btnStress.disabled = !isOnline;
}

// ==================== UTILS ====================
function showToast(type, msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚡' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${msg}</span>`;

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Auto eliminar
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Exportar funciones al window para que el HTML pueda llamarlas (onclick)
window.startServer = startServer;
window.stopServer = stopServer;
window.stressTest = stressTest;
window.toggleTheme = toggleTheme;
window.filterServers = filterServers;