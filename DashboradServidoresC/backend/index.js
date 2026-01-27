const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

// ============================================================
// CONFIGURACIÓN
// ============================================================
const CONFIG = {
  PORT: 3000,
  SERVERS: {
    '1': {
      name: '🇪🇸 Servidor Madrid',
      multipassName: 'servidor-1',
      ip: '192.168.2.2'
    },
    '2': {
      name: '🇳🇴 Servidor Oslo',
      multipassName: 'servidor-2',
      ip: '192.168.2.3'
    },
    '3': {
      name: '🇨🇳 Servidor Beijing',
      multipassName: 'servidor-3',
      ip: '192.168.2.4'
    },
    '4': {
      name: '🇨🇴 Servidor Bogotá',
      multipassName: 'servidor-4',
      ip: '192.168.2.5'
    }
  }
};

// 🔒 CANDADO DE SEGURIDAD
const shutdownLocks = {};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------
// FUNCIONES AUXILIARES
// ---------------------------------------------------------

/**
 * 📢 NUEVO: Función para escribir logs bonitos en la terminal
 */
function logSystem(emoji, message) {
  const now = new Date();
  const time = now.toLocaleTimeString('es-ES', { hour12: false });
  console.log(`[${time}] ${emoji} ${message}`);
}

function getServerStatus(vmName) {
  return new Promise((resolve) => {
    exec(`multipass info ${vmName} --format json`, (error, stdout, stderr) => {
      if (error || stderr) {
        resolve('Stopped');
      } else {
        try {
          const info = JSON.parse(stdout);
          const vmInfo = info.info[vmName];
          // Aceptamos Running o Suspended
          if (vmInfo && (vmInfo.state === 'Running' || vmInfo.state === 'Suspended')) {
            return resolve(vmInfo.state);
          }
          resolve('Stopped');
        } catch (e) {
          resolve('Stopped');
        }
      }
    });
  });
}

function runMultipassCommand(vmName, command) {
  return new Promise((resolve, reject) => {
    exec(`multipass exec ${vmName} -- ${command}`, (error, stdout, stderr) => {
      if (error) {
        if (stderr.includes('is not running') || stderr.includes('does not exist')) {
          reject(new Error('Servidor apagado'));
        } else {
          reject(new Error(stderr || error.message));
        }
      } else {
        resolve(stdout);
      }
    });
  });
}

function runLocalMultipass(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout);
    });
  });
}

function parseMemory(freeOutput) {
  const lines = freeOutput.trim().split('\n');
  const memLine = lines.find(line => line.includes('Mem:'));
  if (!memLine) return { total: 0, used: 0, percentage: 0 };
  const parts = memLine.trim().split(/\s+/);
  const total = parseInt(parts[1], 10);
  const used = parseInt(parts[2], 10);
  return { total, used, percentage: Math.round((used / total) * 100) };
}

function parseCPU(topOutput) {
  const lines = topOutput.split('\n');
  const cpuLine = lines.find(line => line.includes('%Cpu') || line.includes('Cpu(s)'));
  if (!cpuLine) return { usage: 0 };
  const idleMatch = cpuLine.match(/(\d+\.?\d*)\s*id/);
  const idle = idleMatch ? parseFloat(idleMatch[1]) : 100;
  return { usage: Math.round(100 - idle) };
}

// ================= ENDPOINTS =================

app.get('/api/servers', (req, res) => {
  const servers = Object.entries(CONFIG.SERVERS).map(([id, server]) => ({
    id, name: server.name, ip: server.ip
  }));
  res.json(servers);
});

// GET STATS
app.get('/api/server/:id/stats', async (req, res) => {
  const { id } = req.params;
  const server = CONFIG.SERVERS[id];

  if (shutdownLocks[id]) {
    return res.json({
      status: 'offline',
      serverName: server.name,
      ip: server.ip
    });
  }

  try {
    const status = await getServerStatus(server.multipassName);

    if (status !== 'Running') {
      return res.json({
        status: 'offline',
        serverName: server.name,
        ip: server.ip
      });
    }

    const [freeOut, topOut] = await Promise.all([
      runMultipassCommand(server.multipassName, 'free -m'),
      runMultipassCommand(server.multipassName, 'top -bn1 | head -5')
    ]);

    res.json({
      status: 'online',
      serverName: server.name,
      ip: server.ip,
      memory: parseMemory(freeOut),
      cpu: parseCPU(topOut)
    });

  } catch (error) {
    res.json({
      status: 'offline',
      serverName: server.name || 'Desconocido',
      error: 'Offline'
    });
  }
});

// START (Con Logs en Terminal)
app.post('/api/server/:id/start', async (req, res) => {
  const { id } = req.params;
  const server = CONFIG.SERVERS[id];

  delete shutdownLocks[id];

  // LOG: Aviso de inicio
  logSystem('🚀', `Iniciando ${server.name}...`);

  try {
    await runLocalMultipass(`multipass start ${server.multipassName}`);

    // LOG: Éxito
    logSystem('✅', `${server.name} está ONLINE y listo.`);
    res.json({ success: true, message: 'Iniciando...' });

  } catch (error) {
    // LOG: Error
    logSystem('❌', `Error al iniciar ${server.name}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// STOP/SUSPEND (Con Logs en Terminal)
app.post('/api/server/:id/stop', async (req, res) => {
  const { id } = req.params;
  const server = CONFIG.SERVERS[id];

  shutdownLocks[id] = true;

  // LOG: Aviso de suspensión
  logSystem('🌙', `Suspendiendo ${server.name} (Hibernación)...`);

  setTimeout(() => {
    delete shutdownLocks[id];
  }, 15000);

  try {
    await runLocalMultipass(`multipass suspend ${server.multipassName}`);

    // LOG: Éxito
    logSystem('💤', `${server.name} está HIBERNANDO correctamente.`);
    res.json({ success: true, message: 'Suspendiendo (Modo Rápido)...' });

  } catch (error) {
    logSystem('⚠️', `Fallo al suspender ${server.name}, intentando apagado forzoso...`);
    try {
      await runLocalMultipass(`multipass stop ${server.multipassName}`);
      logSystem('🔌', `${server.name} APAGADO (Forzado).`);
      res.json({ success: true, message: 'Apagando (Force)...' });
    } catch (err) {
      logSystem('❌', `Error crítico apagando ${server.name}: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// STRESS TEST (Con Logs en Terminal)
app.post('/api/server/:id/stress', async (req, res) => {
  const { id } = req.params;
  const server = CONFIG.SERVERS[id];

  if (shutdownLocks[id]) {
    return res.status(400).json({ success: false, error: 'Servidor apagándose' });
  }

  try {
    const status = await getServerStatus(server.multipassName);
    if (status !== 'Running') {
      return res.status(400).json({ success: false, error: 'El servidor está apagado' });
    }

    // LOG: Inicio Test
    logSystem('🔥', `Ejecutando TEST DE ESTRÉS en ${server.name} (10s)...`);

    runMultipassCommand(server.multipassName, 'timeout 10s bash -c "yes > /dev/null"')
      .then(() => logSystem('🏁', `Test finalizado en ${server.name}.`))
      .catch(() => logSystem('ℹ️', `Test finalizado en ${server.name} (Timeout normal).`));

    res.json({ success: true, message: '🔥 Test de CPU iniciado (10s)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 🆕 SISTEMA DE PROGRAMACIÓN (SCHEDULER)
// ============================================================
const schedules = {};
// Formato: { '1': { start: '08:00', stop: '20:00' }, '2': { start: '', stop: '' } }

// Endpoint para GUARDAR programación
app.post('/api/server/:id/schedule', (req, res) => {
  const { id } = req.params;
  const { start, stop } = req.body;

  if (!CONFIG.SERVERS[id]) {
    return res.status(404).json({ success: false, error: 'Servidor no encontrado' });
  }

  schedules[id] = { start: start || '', stop: stop || '' };
  logSystem('📅', `Programación guardada para servidor ${id}: Encender=${start || 'N/A'}, Apagar=${stop || 'N/A'}`);

  res.json({ success: true, message: 'Programación guardada', schedule: schedules[id] });
});

// Endpoint para OBTENER programación
app.get('/api/server/:id/schedule', (req, res) => {
  const { id } = req.params;

  if (!CONFIG.SERVERS[id]) {
    return res.status(404).json({ success: false, error: 'Servidor no encontrado' });
  }

  res.json({ success: true, schedule: schedules[id] || { start: '', stop: '' } });
});

// ⏰ CRON: Se ejecuta cada 30 segundos
setInterval(async () => {
  const now = new Date();
  const currentTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

  for (const [id, schedule] of Object.entries(schedules)) {
    const server = CONFIG.SERVERS[id];
    if (!server) continue;

    try {
      const status = await getServerStatus(server.multipassName);

      // ¿Toca ENCENDER?
      if (schedule.start === currentTime && status !== 'Running' && !shutdownLocks[id]) {
        logSystem('⏰', `Ejecutando tarea programada: ENCENDIENDO ${server.name}...`);
        await runLocalMultipass(`multipass start ${server.multipassName}`);
        logSystem('✅', `${server.name} encendido por SCHEDULER.`);
      }

      // ¿Toca APAGAR?
      if (schedule.stop === currentTime && status === 'Running' && !shutdownLocks[id]) {
        logSystem('⏰', `Ejecutando tarea programada: APAGANDO ${server.name}...`);
        shutdownLocks[id] = true;
        setTimeout(() => { delete shutdownLocks[id]; }, 15000);
        await runLocalMultipass(`multipass suspend ${server.multipassName}`);
        logSystem('💤', `${server.name} suspendido por SCHEDULER.`);
      }
    } catch (error) {
      logSystem('❌', `Error en scheduler para ${server.name}: ${error.message}`);
    }
  }
}, 30000); // Cada 30 segundos

app.listen(CONFIG.PORT, () => {
  console.log('===================================================');
  console.log(`🚀 CENTRO DE CONTROL LISTO en: http://localhost:${CONFIG.PORT}`);
  console.log('📋 Esperando comandos...');
  console.log('⏰ Scheduler activo (revisa cada 30 segundos)');
  console.log('===================================================');
});