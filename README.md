# CyberWG
CyberWG Wireguard Web GUI and Installer

This is a website management panel for WireGuard VPN server. It allows you to Add, Delete clients as well as set an expiry date. Download config file, QR Code as well as some basic stats
It is designed to run on linux hosts. Please read installation requirements below in order to avoid issues.
I designed this due to so many other projects required docker or alot of configurations. It was designed to be simple to setup and easy to use but run directly without the need of docker.

Requirements:
OS: Ubuntu / Debian | CentOS / RHEL | Arch


WireGuard: 

Ubuntu/Debian: sudo apt install wireguard

CentOS/RHEL: sudo yum install wireguard-tools

Arch: sudo pacman -S wireguard-tools

NodeJS:

Ubuntu/Debian: sudo apt install nodejs -y

CentOS/RHEL: sudo yum install epel-release | sudo yum install nodejs

Arch: sudo pacman -S nodejs npm

Upload all files contained into a folder on your server. Run the installer sh install.sh 

The installer will guide you the rest of the way.

If you find that you are unable to access the internet when connected to WireGuard run the following sh fix-internet.sh
