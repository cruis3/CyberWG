#!/bin/bash

# WG-Easy Standalone Installation Script

set -e

echo "======================================"
echo "CyberWG Installation"
echo "======================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then 
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Check if WireGuard is installed
if ! command -v wg >/dev/null 2>&1; then
    echo "❌ WireGuard is not installed"
    echo ""
    echo "Please install WireGuard first:"
    echo "  Ubuntu/Debian: sudo apt install wireguard"
    echo "  CentOS/RHEL: sudo yum install wireguard-tools"
    echo "  Arch: sudo pacman -S wireguard-tools"
    exit 1
fi

echo "✅ WireGuard is installed"

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed"
    echo ""
    echo "Please install Node.js first:"
    echo "  Visit https://nodejs.org/ or use your package manager"
    exit 1
fi

echo "✅ Node.js is installed ($(node --version))"

# Install npm dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Check if WireGuard interface exists
WG_INTERFACE=${WG_INTERFACE:-wg0}

if [ ! -f "/etc/wireguard/${WG_INTERFACE}.conf" ]; then
    echo ""
    echo "⚠️  WireGuard interface ${WG_INTERFACE} not configured"
    echo ""
    echo "Would you like to create a basic WireGuard configuration? (y/n)"
    read -r REPLY
    echo ""
    
    if [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
        # Generate keys
        PRIVATE_KEY=$(wg genkey)
        PUBLIC_KEY=$(echo "$PRIVATE_KEY" | wg pubkey)
        
        # Get the default network interface
        DEFAULT_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -n1)
        
        echo ""
        echo "📝 Creating WireGuard configuration..."
        
        # Create config file
        cat > /etc/wireguard/${WG_INTERFACE}.conf << EOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = $PRIVATE_KEY

# Enable IP forwarding
PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -A FORWARD -i ${WG_INTERFACE} -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -o ${DEFAULT_INTERFACE} -j MASQUERADE
PostDown = iptables -D FORWARD -i ${WG_INTERFACE} -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o ${DEFAULT_INTERFACE} -j MASQUERADE
EOF
        
        chmod 600 /etc/wireguard/${WG_INTERFACE}.conf
        
        echo "✅ WireGuard configuration created"
        echo "   Public Key: $PUBLIC_KEY"
        echo "   Private Key: (saved in /etc/wireguard/${WG_INTERFACE}.conf)"
        
        # Enable and start WireGuard
        echo ""
        systemctl enable wg-quick@${WG_INTERFACE}
        systemctl start wg-quick@${WG_INTERFACE}
        
        echo "✅ WireGuard interface started"
    fi
else
    echo "✅ WireGuard interface ${WG_INTERFACE} is configured"
fi

# Get public IP
echo ""
echo "🌐 Detecting public IP address..."
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "")

if [ -z "$PUBLIC_IP" ]; then
    echo "⚠️  Could not detect public IP automatically"
    echo "Enter your server's public IP or domain:"
    read PUBLIC_IP
fi

echo "   Public IP/Domain: $PUBLIC_IP"

# Set password
echo ""
echo "Enter password for web interface:"
stty -echo
read WEB_PASSWORD
stty echo
echo ""

echo "Confirm password:"
stty -echo
read WEB_PASSWORD_CONFIRM
stty echo
echo ""

if [ "$WEB_PASSWORD" != "$WEB_PASSWORD_CONFIRM" ]; then
    echo "❌ Passwords do not match"
    exit 1
fi

# Create data directory
mkdir -p data

# Create systemd service
echo ""
echo "📋 Creating systemd service..."

cat > /etc/systemd/system/cyberwg.service << EOF
[Unit]
Description=CyberWG - Advanced WireGuard Management
After=network.target wg-quick@${WG_INTERFACE}.service

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
Environment="WG_HOST=${PUBLIC_IP}"
Environment="PASSWORD=${WEB_PASSWORD}"
Environment="PORT=51821"
Environment="WG_INTERFACE=${WG_INTERFACE}"
Environment="WG_PORT=51820"
Environment="WG_DEFAULT_ADDRESS=10.8.0.x"
Environment="WG_DEFAULT_DNS=1.1.1.1"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable cyberwg
systemctl start cyberwg

echo "✅ Service created and started"

# Configure firewall if available
echo ""
if command -v ufw >/dev/null 2>&1; then
    echo "🔒 Configuring UFW firewall..."
    ufw allow 51820/udp comment 'WireGuard'
    ufw allow 51821/tcp comment 'WG-Easy Web Interface'
    echo "✅ Firewall rules added"
elif command -v firewall-cmd >/dev/null 2>&1; then
    echo "🔒 Configuring firewalld..."
    firewall-cmd --permanent --add-port=51820/udp
    firewall-cmd --permanent --add-port=51821/tcp
    firewall-cmd --reload
    echo "✅ Firewall rules added"
else
    echo "⚠️  No firewall detected. Make sure ports 51820/udp and 51821/tcp are open"
fi

echo ""
echo "======================================"
echo "✅ CyberWG Installation Complete!"
echo "======================================"
echo ""
echo "Access the web interface at:"
echo "  http://${PUBLIC_IP}:51821"
echo ""
echo "Default credentials:"
echo "  Password: (the one you just set)"
echo ""
echo "Service commands:"
echo "  Start:   sudo systemctl start cyberwg"
echo "  Stop:    sudo systemctl stop cyberwg"
echo "  Restart: sudo systemctl restart cyberwg"
echo "  Status:  sudo systemctl status cyberwg"
echo "  Logs:    sudo journalctl -u cyberwg -f"
echo ""
echo "WireGuard commands:"
echo "  Status:  sudo wg show"
echo "  Start:   sudo systemctl start wg-quick@${WG_INTERFACE}"
echo "  Stop:    sudo systemctl stop wg-quick@${WG_INTERFACE}"
echo ""
