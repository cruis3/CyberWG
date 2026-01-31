#!/bin/bash

# WireGuard Internet Access Fix Script

echo "======================================"
echo "WireGuard Internet Access Fix"
echo "======================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then 
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

WG_INTERFACE=${1:-wg0}
echo "WireGuard Interface: $WG_INTERFACE"
echo ""

# Step 1: Check IP forwarding
echo "🔍 Checking IP forwarding..."
IP_FORWARD=$(sysctl net.ipv4.ip_forward | awk '{print $3}')

if [ "$IP_FORWARD" = "0" ]; then
    echo "⚠️  IP forwarding is DISABLED"
    echo "   Enabling IP forwarding..."
    sysctl -w net.ipv4.ip_forward=1
    
    # Make it persistent
    if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf; then
        echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    fi
    echo "✅ IP forwarding enabled"
else
    echo "✅ IP forwarding is enabled"
fi

echo ""

# Step 2: Detect network interface
echo "🔍 Detecting default network interface..."
DEFAULT_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -n1)

if [ -z "$DEFAULT_INTERFACE" ]; then
    echo "❌ Could not detect default network interface"
    echo "Available interfaces:"
    ip link show | grep -E "^[0-9]+" | awk '{print $2}' | sed 's/://'
    echo ""
    echo "Please enter your network interface name (e.g., eth0, ens3, enp0s3):"
    read DEFAULT_INTERFACE
fi

echo "   Default interface: $DEFAULT_INTERFACE"
echo ""

# Step 3: Check and fix iptables rules
echo "🔍 Checking iptables rules..."

# Check if NAT rule exists
if ! iptables -t nat -C POSTROUTING -s 10.8.0.0/24 -o "$DEFAULT_INTERFACE" -j MASQUERADE 2>/dev/null; then
    echo "⚠️  NAT rule not found, adding..."
    iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o "$DEFAULT_INTERFACE" -j MASQUERADE
    echo "✅ NAT rule added"
else
    echo "✅ NAT rule exists"
fi

# Check if FORWARD rule exists
if ! iptables -C FORWARD -i "$WG_INTERFACE" -j ACCEPT 2>/dev/null; then
    echo "⚠️  FORWARD rule not found, adding..."
    iptables -A FORWARD -i "$WG_INTERFACE" -j ACCEPT
    iptables -A FORWARD -o "$WG_INTERFACE" -j ACCEPT
    echo "✅ FORWARD rules added"
else
    echo "✅ FORWARD rules exist"
fi

echo ""

# Step 4: Make iptables rules persistent
echo "🔍 Making iptables rules persistent..."

if command -v iptables-save >/dev/null 2>&1; then
    if command -v netfilter-persistent >/dev/null 2>&1; then
        netfilter-persistent save
        echo "✅ Rules saved with netfilter-persistent"
    elif [ -d /etc/iptables ]; then
        iptables-save > /etc/iptables/rules.v4
        echo "✅ Rules saved to /etc/iptables/rules.v4"
    else
        echo "⚠️  Please install iptables-persistent:"
        echo "   Ubuntu/Debian: sudo apt install iptables-persistent"
    fi
fi

echo ""

# Step 5: Update WireGuard config
echo "🔍 Checking WireGuard configuration..."

WG_CONFIG="/etc/wireguard/${WG_INTERFACE}.conf"

if [ -f "$WG_CONFIG" ]; then
    # Check if PostUp/PostDown rules are correct
    if ! grep -q "PostUp.*MASQUERADE" "$WG_CONFIG"; then
        echo "⚠️  WireGuard config needs updating"
        echo "   Creating backup..."
        cp "$WG_CONFIG" "${WG_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Remove old PostUp/PostDown if they exist
        sed -i '/^PostUp/d' "$WG_CONFIG"
        sed -i '/^PostDown/d' "$WG_CONFIG"
        
        # Add new PostUp/PostDown after [Interface]
        sed -i "/^\[Interface\]/a PostUp = sysctl -w net.ipv4.ip_forward=1\\
PostUp = iptables -A FORWARD -i ${WG_INTERFACE} -j ACCEPT\\
PostUp = iptables -A FORWARD -o ${WG_INTERFACE} -j ACCEPT\\
PostUp = iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o ${DEFAULT_INTERFACE} -j MASQUERADE\\
PostDown = iptables -D FORWARD -i ${WG_INTERFACE} -j ACCEPT\\
PostDown = iptables -D FORWARD -o ${WG_INTERFACE} -j ACCEPT\\
PostDown = iptables -t nat -D POSTROUTING -s 10.8.0.0/24 -o ${DEFAULT_INTERFACE} -j MASQUERADE" "$WG_CONFIG"
        
        echo "✅ WireGuard config updated"
        echo "   Backup saved to ${WG_CONFIG}.backup.*"
    else
        echo "✅ WireGuard config looks good"
    fi
else
    echo "⚠️  WireGuard config not found at $WG_CONFIG"
fi

echo ""

# Step 6: Restart WireGuard
echo "🔄 Restarting WireGuard..."
systemctl restart wg-quick@${WG_INTERFACE}

if systemctl is-active --quiet wg-quick@${WG_INTERFACE}; then
    echo "✅ WireGuard restarted successfully"
else
    echo "❌ WireGuard failed to start"
    echo "Check logs: sudo journalctl -u wg-quick@${WG_INTERFACE} -n 50"
    exit 1
fi

echo ""

# Step 7: Show current configuration
echo "======================================"
echo "Current Configuration"
echo "======================================"
echo ""
echo "IP Forwarding:"
sysctl net.ipv4.ip_forward
echo ""
echo "WireGuard Status:"
wg show
echo ""
echo "NAT Rules:"
iptables -t nat -L POSTROUTING -n -v | grep 10.8.0
echo ""
echo "FORWARD Rules:"
iptables -L FORWARD -n -v | grep "$WG_INTERFACE"
echo ""

# Step 8: Test instructions
echo "======================================"
echo "Testing Instructions"
echo "======================================"
echo ""
echo "From a connected client, test with:"
echo "  1. ping 10.8.0.1 (WireGuard server)"
echo "  2. ping 8.8.8.8 (Google DNS - tests routing)"
echo "  3. ping google.com (tests DNS resolution)"
echo ""
echo "If ping 8.8.8.8 fails but ping 10.8.0.1 works:"
echo "  - The issue is with NAT/routing (this script should have fixed it)"
echo ""
echo "If ping google.com fails but ping 8.8.8.8 works:"
echo "  - The issue is with DNS (check client's DNS settings)"
echo ""
echo "======================================"
echo "✅ Fix script completed!"
echo "======================================"
