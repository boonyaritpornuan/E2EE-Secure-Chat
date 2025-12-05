# benull.

> **Speak Freely. Leave No Trace.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](e2ee-secure-chat/LICENSE)
[![Website](https://img.shields.io/badge/Website-benull.org-39FF14)](https://benull.org/)
[![Facebook](https://img.shields.io/badge/Facebook-benull.-blue)](https://www.facebook.com/profile.php?id=61584506919173)

**benull.** is a secure, peer-to-peer, end-to-end encrypted chat application designed for absolute privacy. It runs entirely in your browser, stores no data on any server, and requires no sign-up.

---

## 🔗 Connect with Us

- 🌐 **Website:** [benull.org](https://benull.org/)
- 🐙 **GitHub:** [github.com/benull-org](https://github.com/benull-org)
- 📘 **Facebook:** [benull. Official](https://www.facebook.com/profile.php?id=61584506919173)
- 📧 **Email:** [dev@benull.org](mailto:dev@benull.org)

---

## ✨ Key Features

- **🔒 Zero Knowledge Architecture**
  We don't know who you are, who you talk to, or what you say. Your identity is a mathematical ghost.

- **🛡️ Military-Grade E2EE**
  Secured with AES-GCM 256-bit encryption and RSA-OAEP before leaving your device.

- **⚡ Peer-to-Peer (P2P)**
  Direct connection between users via WebRTC for maximum privacy and speed.

- **🚫 No Sign-up Required**
  Frictionless anonymity. Just generate a link and share. No email, no phone, no account.

- **💣 The "Kill Switch"**
  Close the tab, and the encryption keys are destroyed instantly. The conversation ceases to exist.

- **📂 Secure File Transfer**
  Send files directly to peers without them ever touching a server's disk.

- **📱 PWA Support**
  Install on iOS, Android, or Desktop for an app-like experience without the store tracking.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Cryptography:** Web Crypto API (Native browser standard)
- **Real-time:** Socket.io (Signaling only), WebRTC (Data channels)
- **Backend:** Node.js (Signaling server only - no DB)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or bun

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/benull-org/e2ee-secure-chat.git
   cd e2ee-secure-chat
   ```

2. **Install Dependencies**
   ```bash
   # Install Client dependencies
   cd e2ee-secure-chat
   npm install

   # Install Nexus (Signaling) dependencies
   cd ../nexus
   npm install
   ```

3. **Configuration**
   - Copy `.env.example` to `.env` in the `e2ee-secure-chat` directory.
   ```bash
   cd ../e2ee-secure-chat
   cp .env.example .env
   ```

4. **Run Locally**
   You need to run both the signaling nexus and the client.

   **Terminal 1 (Nexus):**
   ```bash
   cd nexus
   npm start
   ```

   **Terminal 2 (Client):**
   ```bash
   cd e2ee-secure-chat
   npm run dev
   ```

5. **Open in Browser**
   Visit `http://localhost:5173`

---

## 🤝 Contributing

We welcome contributions! Please check out our [GitHub](https://github.com/benull-org) for issues and pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](e2ee-secure-chat/LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for Privacy by the benull. team
</p>
