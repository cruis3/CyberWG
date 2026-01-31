# CyberWG

⚡ **CyberWG** - A modern, feature-rich WireGuard management interface with a cyberpunk aesthetic. No Docker required!

![Version](https://img.shields.io/badge/version-2.0.0-00f0ff)
![License](https://img.shields.io/badge/license-MIT-ff00aa)

## ✨ Features

### Core Features
- ✅ **Modern Cyberpunk UI** - Dark theme with neon accents and smooth animations
- ✅ **No Docker Required** - Runs directly with Node.js
- ✅ **Client Management** - Create, edit, disable, and delete clients
- ✅ **QR Code Generation** - Easy mobile device setup
- ✅ **Config Downloads** - Download .conf files for any client

### Advanced Features
- 📊 **Bandwidth Tracking** - Monitor data transfer per client
- ⏰ **Client Expiration** - Set expiry dates for temporary access
- 📝 **Client Notes** - Add notes and descriptions to clients
- 🕐 **Last Seen** - Track when clients were last connected
- 🔍 **Live Search** - Filter clients in real-time
- 📈 **Statistics Dashboard** - Overview of all clients and usage
- 🔔 **Toast Notifications** - Beautiful feedback for all actions
- 🎨 **Glassmorphism Design** - Modern blur effects and animations

## 🚀 Quick Start

### Prerequisites

1. **WireGuard** - Must be installed
2. **Node.js** - v14 or higher
3. **Root/sudo access** - Required for WireGuard management

### Installation

```bash
# Extract the archive
unzip cyberwg.zip
cd cyberwg

# Run the automated installer
sudo ./install.sh
```

The installer will:
- Install dependencies
- Configure WireGuard (if needed)
- Set up systemd service
- Configure firewall
- Start CyberWG

### Manual Installation

```bash
# Install dependencies
npm install

# Configure environment
export WG_HOST=your.server.ip
export PASSWORD=your_password

# Start the server
sudo npm start
```

Access at `http://your-server:51821`

## 🎯 New Features Guide

### Bandwidth Tracking
Each client card automatically displays:
- Data received (⬇️)
- Data sent (⬆️)
- Total transfer

### Client Expiration
When creating a client, set an expiry date:
- 7 days
- 30 days
- 90 days
- 1 year
- Never expires

Expired clients are automatically disabled.

### Client Notes
Add notes to clients for:
- Device information
- User details
- Access purpose
- Special configurations

### Last Seen
Track client activity:
- "Just now" - Connected within 2 minutes
- "X min ago" - Recent connection
- "X hours ago" - Connected today
- "X days ago" - Older connections
- "Never" - Never connected

## ⚙️ Configuration

### Environment Variables

```bash
# Required
WG_HOST=your.server.ip          # Public IP or domain
PASSWORD=your_password           # Web interface password

# Optional
PORT=51821                       # Web interface port
WG_INTERFACE=wg0                # WireGuard interface
WG_PORT=51820                   # WireGuard port
WG_DEFAULT_ADDRESS=10.8.0.x     # Client IP template
WG_DEFAULT_DNS=1.1.1.1          # DNS server
WG_ALLOWED_IPS=0.0.0.0/0,::/0   # Allowed routes
WG_PERSISTENT_KEEPALIVE=0       # Keepalive interval
DATA_DIR=./data                 # Data storage
```

### Systemd Service

```bash
# View status
sudo systemctl status cyberwg

# Start/stop/restart
sudo systemctl start cyberwg
sudo systemctl stop cyberwg
sudo systemctl restart cyberwg

# View logs
sudo journalctl -u cyberwg -f
```

## 🔧 Troubleshooting

### Clients Can't Access Internet

Run the fix script:
```bash
sudo ./fix-internet.sh
```

See `TROUBLESHOOTING.md` for detailed help.

### Common Issues

**WireGuard not starting**
```bash
sudo systemctl status wg-quick@wg0
sudo journalctl -u wg-quick@wg0
```

**Web interface not accessible**
```bash
sudo lsof -i :51821
sudo journalctl -u cyberwg
```

**Permission errors**
Must run with root/sudo privileges.

## 🛡️ Security

- Use strong passwords
- Use HTTPS with reverse proxy in production
- Restrict access to trusted IPs if possible
- Keep system and WireGuard updated
- Regular backups of `/etc/wireguard/` and data directory

## 📖 API Endpoints

```
POST   /api/client           - Create client
GET    /api/client/:id       - Get client info
PUT    /api/client/:id       - Update client (notes, expiry)
DELETE /api/client/:id       - Delete client
POST   /api/client/:id/toggle - Enable/disable client
GET    /api/client/:id/config - Download config
GET    /api/client/:id/qrcode - Get QR code
GET    /api/stats            - Get statistics
```

## 🎨 Theme Customization

The cyberpunk theme uses CSS variables. Edit `/public/css/style.css`:

```css
:root {
  --bg-primary: #0a0e27;
  --accent-primary: #00f0ff;
  --accent-secondary: #ff00aa;
  /* ... more variables */
}
```

## 📝 Changelog

### v2.0.0
- 🎨 Complete UI overhaul with cyberpunk theme
- 📊 Added bandwidth tracking
- ⏰ Added client expiration
- 📝 Added client notes
- 🕐 Added last seen tracking
- 📈 Enhanced statistics dashboard
- 🔍 Added live search
- ✏️ Added edit client functionality

### v1.0.0
- Initial release
- Basic client management
- QR code generation
- Config downloads

## 🤝 Contributing

Contributions welcome! Feel free to submit issues and pull requests.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

Inspired by the original [wg-easy](https://github.com/wg-easy/wg-easy) Docker project.

---

**Made with ⚡ by the CyberWG team**
