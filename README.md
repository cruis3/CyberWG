# CyberWG
CyberWG Wireguard Web GUI and Installer

This is a website management panel for WireGuard VPN server. It allows you to Add, Delete clients as well as set an expiry date. Download config file, QR Code as well as some basic stats
It is designed to run on linux hosts. Please read installation requirements below in order to avoid issues.
I designed this due to so many other projects required docker or alot of configurations. I was designed to be simple to setup and easy to use but run directly without the need of docker.

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

