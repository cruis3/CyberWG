const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 51821;
const PASSWORD = process.env.PASSWORD || 'admin';
const WG_INTERFACE = process.env.WG_INTERFACE || 'wg0';
const WG_HOST = process.env.WG_HOST || '';
const WG_PORT = process.env.WG_PORT || 51820;
const WG_DEFAULT_ADDRESS = process.env.WG_DEFAULT_ADDRESS || '10.8.0.x';
const WG_DEFAULT_DNS = process.env.WG_DEFAULT_DNS || '1.1.1.1';
const WG_ALLOWED_IPS = process.env.WG_ALLOWED_IPS || '0.0.0.0/0, ::/0';
const WG_PERSISTENT_KEEPALIVE = process.env.WG_PERSISTENT_KEEPALIVE || '0';

// Store client data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: uuidv4(),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Initialize data directory
async function initDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(CLIENTS_FILE);
    } catch {
      await fs.writeFile(CLIENTS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error initializing data directory:', err);
  }
}

// Load clients
async function loadClients() {
  try {
    const data = await fs.readFile(CLIENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save clients
async function saveClients(clients) {
  await fs.writeFile(CLIENTS_FILE, JSON.stringify(clients, null, 2));
}

// Get bandwidth stats for a peer
async function getBandwidthStats(publicKey) {
  try {
    const { stdout } = await execAsync(`wg show ${WG_INTERFACE} dump`);
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts[0] === publicKey) {
        return {
          received: parseInt(parts[5]) || 0,
          sent: parseInt(parts[6]) || 0,
          lastHandshake: parseInt(parts[4]) || 0
        };
      }
    }
  } catch (err) {
    console.error('Error getting bandwidth stats:', err);
  }
  return { received: 0, sent: 0, lastHandshake: 0 };
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Get server config
async function getServerConfig() {
  try {
    const { stdout } = await execAsync(`wg show ${WG_INTERFACE}`);
    const lines = stdout.split('\n');
    let serverPublicKey = '';
    
    for (const line of lines) {
      if (line.includes('public key:')) {
        serverPublicKey = line.split(':')[1].trim();
        break;
      }
    }
    
    return { publicKey: serverPublicKey };
  } catch (err) {
    console.error('Error getting server config:', err);
    return { publicKey: '' };
  }
}

// Generate client config
function generateClientConfig(client, serverPublicKey) {
  return `[Interface]
PrivateKey = ${client.privateKey}
Address = ${client.address}
DNS = ${WG_DEFAULT_DNS}

[Peer]
PublicKey = ${serverPublicKey}
PresharedKey = ${client.presharedKey}
AllowedIPs = ${WG_ALLOWED_IPS}
Endpoint = ${WG_HOST}:${WG_PORT}
PersistentKeepalive = ${WG_PERSISTENT_KEEPALIVE}`;
}

// Generate keys
async function generateKeys() {
  const { stdout: privateKey } = await execAsync('wg genkey');
  const { stdout: publicKey } = await execAsync(`echo "${privateKey.trim()}" | wg pubkey`);
  const { stdout: presharedKey } = await execAsync('wg genpsk');
  
  return {
    privateKey: privateKey.trim(),
    publicKey: publicKey.trim(),
    presharedKey: presharedKey.trim()
  };
}

// Get next available IP
async function getNextIP() {
  const clients = await loadClients();
  const baseIP = WG_DEFAULT_ADDRESS.replace('.x', '');
  let nextNum = 2;
  
  const usedIPs = clients.map(c => {
    const match = c.address.match(/\.(\d+)\/\d+$/);
    return match ? parseInt(match[1]) : 0;
  });
  
  while (usedIPs.includes(nextNum)) {
    nextNum++;
  }
  
  return `${baseIP}.${nextNum}/32`;
}

// Add peer to WireGuard
async function addPeer(client) {
  const cmd = `wg set ${WG_INTERFACE} peer ${client.publicKey} preshared-key <(echo "${client.presharedKey}") allowed-ips ${client.address.replace('/32', '/32')}`;
  await execAsync(cmd, { shell: '/bin/bash' });
  await execAsync(`wg-quick save ${WG_INTERFACE}`);
}

// Remove peer from WireGuard
async function removePeer(publicKey) {
  await execAsync(`wg set ${WG_INTERFACE} peer ${publicKey} remove`);
  await execAsync(`wg-quick save ${WG_INTERFACE}`);
}

// Enable/Disable peer
async function togglePeer(client, enabled) {
  if (enabled) {
    await addPeer(client);
  } else {
    await removePeer(client.publicKey);
  }
}

// Check if client is expired
function isExpired(expiryDate) {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

// Routes
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { password } = req.body;
  
  if (password === PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Invalid password' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/', requireAuth, async (req, res) => {
  const clients = await loadClients();
  
  // Get bandwidth stats for all clients
  for (const client of clients) {
    const stats = await getBandwidthStats(client.publicKey);
    client.bandwidth = {
      received: formatBytes(stats.received),
      sent: formatBytes(stats.sent),
      receivedRaw: stats.received,
      sentRaw: stats.sent
    };
    
    // Calculate last seen
    if (stats.lastHandshake > 0) {
      const lastSeen = Math.floor((Date.now() / 1000) - stats.lastHandshake);
      if (lastSeen < 120) {
        client.lastSeen = 'Just now';
      } else if (lastSeen < 3600) {
        client.lastSeen = `${Math.floor(lastSeen / 60)} min ago`;
      } else if (lastSeen < 86400) {
        client.lastSeen = `${Math.floor(lastSeen / 3600)} hours ago`;
      } else {
        client.lastSeen = `${Math.floor(lastSeen / 86400)} days ago`;
      }
    } else {
      client.lastSeen = 'Never';
    }
    
    // Check expiry
    if (client.expiryDate && isExpired(client.expiryDate)) {
      client.expired = true;
      if (client.enabled) {
        client.enabled = false;
        await togglePeer(client, false);
        await saveClients(clients);
      }
    }
  }
  
  res.render('index', { clients, wgHost: WG_HOST });
});

app.post('/api/client', requireAuth, async (req, res) => {
  try {
    const { name, expiryDays, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const keys = await generateKeys();
    const address = await getNextIP();
    const serverConfig = await getServerConfig();
    
    let expiryDate = null;
    if (expiryDays && parseInt(expiryDays) > 0) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
      expiryDate = expiryDate.toISOString();
    }
    
    const client = {
      id: uuidv4(),
      name,
      ...keys,
      address,
      enabled: true,
      createdAt: new Date().toISOString(),
      expiryDate,
      notes: notes || '',
      totalDataTransfer: 0
    };
    
    const clients = await loadClients();
    clients.push(client);
    await saveClients(clients);
    
    await addPeer(client);
    
    res.json({ success: true, client });
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/client/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, expiryDays } = req.body;
    const clients = await loadClients();
    const client = clients.find(c => c.id === id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    if (notes !== undefined) {
      client.notes = notes;
    }
    
    if (expiryDays !== undefined) {
      if (expiryDays && parseInt(expiryDays) > 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        client.expiryDate = expiryDate.toISOString();
      } else {
        client.expiryDate = null;
      }
    }
    
    await saveClients(clients);
    res.json({ success: true, client });
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/client/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const clients = await loadClients();
    const clientIndex = clients.findIndex(c => c.id === id);
    
    if (clientIndex === -1) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const client = clients[clientIndex];
    await removePeer(client.publicKey);
    
    clients.splice(clientIndex, 1);
    await saveClients(clients);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/client/:id/toggle', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const clients = await loadClients();
    const client = clients.find(c => c.id === id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Check if expired
    if (client.expiryDate && isExpired(client.expiryDate)) {
      return res.status(400).json({ error: 'Cannot enable expired client' });
    }
    
    client.enabled = !client.enabled;
    await saveClients(clients);
    await togglePeer(client, client.enabled);
    
    res.json({ success: true, enabled: client.enabled });
  } catch (err) {
    console.error('Error toggling client:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/client/:id/config', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const clients = await loadClients();
    const client = clients.find(c => c.id === id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const serverConfig = await getServerConfig();
    const config = generateClientConfig(client, serverConfig.publicKey);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${client.name}.conf"`);
    res.send(config);
  } catch (err) {
    console.error('Error getting config:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/client/:id/qrcode', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const clients = await loadClients();
    const client = clients.find(c => c.id === id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const serverConfig = await getServerConfig();
    const config = generateClientConfig(client, serverConfig.publicKey);
    const qr = await QRCode.toDataURL(config);
    
    res.json({ qrcode: qr });
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const clients = await loadClients();
    let totalReceived = 0;
    let totalSent = 0;
    
    for (const client of clients) {
      const stats = await getBandwidthStats(client.publicKey);
      totalReceived += stats.received;
      totalSent += stats.sent;
    }
    
    res.json({
      totalClients: clients.length,
      activeClients: clients.filter(c => c.enabled).length,
      totalReceived: formatBytes(totalReceived),
      totalSent: formatBytes(totalSent),
      totalTransfer: formatBytes(totalReceived + totalSent)
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
async function start() {
  await initDataDir();
  
  app.listen(PORT, () => {
    console.log(`🚀 CyberWG running on http://localhost:${PORT}`);
    console.log(`🔐 Default password: ${PASSWORD}`);
    console.log(`⚡ WireGuard interface: ${WG_INTERFACE}`);
  });
}

start().catch(console.error);
