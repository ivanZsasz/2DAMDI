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
// Almacena qué servidores se están apagando para no molestarlos
const shutdownLocks = {};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------
// FUNCIONES AUXILIARES
// ---------------------------------------------------------

function getServerStatus(vmName) {
  return new Promise((resolve) => {
    exec(`multipass info ${vmName} --format json`, (error, stdout, stderr) => {
      if (error || stderr) {
        resolve('Stopped');
      } else {
        try {
          const info = JSON.parse(stdout);
          const vmInfo = info.info[vmName];
          if (vmInfo && vmInfo.state === 'Running') {
            resolve('Running');
          } else {
            resolve('Stopped');
          }
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
        // Filtramos errores comunes de máquina apagada
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

// GET STATS (Con Candado Anti-Reinicio)
app.get('/api/server/:id/stats', async (req, res) => {
  const { id } = req.params;
  const server = CONFIG.SERVERS[id];

  // 🔒 1. CHEQUEO DE CANDADO
  // Si acabamos de mandar apagar este servidor, decimos que está OFFLINE
  // sin preguntar a Multipass. Esto evita despertarlo.
  if (shutdownLocks[id]) {
    return res.json({
      status: 'offline',
      serverName: server.name,
      ip: server.ip
    });
  }

  try {
    // 2. Chequeo de estado real
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

// START
app.post('/api/server/:id/start', async (req, res) => {
  const { id } = req.params;
  const server = CONFIG.SERVERS[id];

  // Quitamos el candado si lo encendemos manualmente
  delete shutdownLocks[id];

  try {
    await runLocalMultipass(`multipass start ${server.multipassName}`);
    res.json({ success: true, message: 'Iniciando...' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// STOP (Aquí ponemos el candado)
app.post('/api/server/:id/stop', async (req, res) => {
  const { id } = req.params;
  const server = CONFIG.SERVERS[id];

  // 🔒 ACTIVAR CANDADO
  // Durante 15 segundos, ignoraremos peticiones de stats para este ID
  shutdownLocks[id] = true;
  console.log(`🔒 Bloqueando consultas a ${server.name} durante 15s para apagado seguro.`);

  // Quitamos el candado automáticamente a los 15 segundos
  setTimeout(() => {
    delete shutdownLocks[id];
  }, 15000);

  try {
    await runLocalMultipass(`multipass stop ${server.multipassName}`);
    res.json({ success: true, message: 'Apagando...' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// STRESS TEST
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

    runMultipassCommand(server.multipassName, 'timeout 10s bash -c "yes > /dev/null"')
      .then(() => console.log(`✅ Test completado en ${server.name}`))
      .catch(() => console.log(`ℹ️ Test finalizado en ${server.name} (Timeout normal)`));

    res.json({ success: true, message: '🔥 Test de CPU iniciado (10s)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(CONFIG.PORT, () => {
  console.log(`🚀 Backend BLINDADO listo en: http://localhost:${CONFIG.PORT}`);
});