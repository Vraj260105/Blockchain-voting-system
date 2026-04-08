# 🗳️ Multi-Election Blockchain Voting System

A highly secure, decentralized voting platform engineered with **React, Node.js, and Polygon Smart Contracts**. State-of-the-art Web2 and Web3 technologies ensure cryptographic immutability, seamless user onboarding, and enterprise-grade data management.

---

## 🌟 Core Features

*   **🏆 Multi-Election Architecture:** A single smart contract deployment supports infinite concurrent elections with robust lifecycle management (Setup → Live → Closed).
*   **⛽ Auto-Funding for Voters:** When users successfully register on the decentralized platform, the contract automatically transfers `0.5 POL` to their connected wallet, removing the friction of manual funding and gas fees.
*   **📧 Brevo OTP Verification:** Users register and authenticate securely via an email One-Time Password (OTP) sent instantly through the Brevo API.
*   **🔗 Cryptographic Wallet Binding:** To protect election integrity, a user's active MetaMask wallet is cryptographically bound to their centralized database profile using `ethers.js` signatures.
*   **💅 Premium UI/UX:** Built with React 18, Vite, Tailwind CSS, Framer Motion, and Sonner Toasts. Features a full Dark/Light theme toggle and stunning Recharts-powered analytics for public results.
*   **🛡️ Robust Error Handling:** Both backend HTTP errors and cryptic Solidity `revert` errors are globally caught, parsed into human-readable text, and beautifully surfaced to the user.

---

## 🏗️ System Architecture

This project is separated into three distinct deployment pillars following modern Monorepo patterns.

### 1. 🖥️ Frontend (`/Block-vote`)
The presentation layer, handling real-time chart data, Web3 interactions, and global state.
*   **Core:** React 18, TypeScript, Vite
*   **Routing & State:** React Router DOM (v6), React Context API
*   **UI System:** Tailwind CSS, Framer Motion (micro-animations), Lucide React (icons), Sonner (hot-toast replacements)
*   **Data Visualization:** Recharts (responsive pie/bar charts)
*   **Web3:** `ethers.js` (v6)

### 2. ⚙️ Backend (`/backend`)
The Web2 server handling sensitive profile verification, OTP dispatch, and SQL modeling.
*   **Core:** Node.js, Express.js
*   **Database:** PostgreSQL/MySQL via Sequelize ORM
*   **Auth & Security:** JWT for zero-state sessions, `bcrypt` for hashing, `express-rate-limit`, `cors`, `helmet`
*   **External APIs:** Brevo (Sendinblue) API for transaction emails

### 3. ⛓️ Smart Contracts (`/blockchain`)
The unalterable source-of-truth. Written in Solidity and deployed to the Polygon testnet.
*   **Core:** Solidity (`^0.8.20`)
*   **Framework:** Hardhat + Ethers
*   **Network:** Polygon Amoy Testnet (Chain ID `80002`)

---

## 📁 Repository Structure

```text
blockchain-voting-system/
│
├── Block-vote/               # FRONTEND Application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # Reusable UI (Buttons, Nav, SVGs)
│   │   ├── contexts/         # React Context Providers (AuthContext)
│   │   ├── contracts/        # Contract Interfaces (VotingSystem.json)
│   │   ├── hooks/            # Custom Hooks (useWalletValidation)
│   │   ├── pages/            # Multi-Election Route Views
│   │   ├── services/         # API (Axios) & Web3 Logic (Ethers)
│   │   ├── types/            # TypeScript Interfaces
│   │   ├── index.css         # Tailwind & Theme Token definitions
│   │   └── App.tsx           # Router & Providers Setup
│   └── vite.config.ts
│
├── backend/                  # BACKEND API
│   ├── src/
│   │   ├── config/           # Database (Sequelize) connection
│   │   ├── middleware/       # Auth (JWT) & Role bounds (Admin vs Voter)
│   │   ├── models/           # Relational SQL Tables
│   │   ├── routes/           # REST Endpoints
│   │   ├── services/         # Business Logic (Email, Auth, Audit)
│   │   └── server.js         # Entry node
│   └── .env
│
└── blockchain/               # SMART CONTRACTS
    ├── contracts/            # Solidity files
    │   └── VotingSystem.sol 
    ├── deploy.js             # Deploys contract & auto-copies ABI
    ├── recover-funds.js      # Utility script to rescue trapped POL
    └── hardhat.config.js     # Polygon Network config
```

---

## 🔌 API Route Reference (Backend)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/send-otp` | Sends login/register OTP to email. | No |
| **POST** | `/api/auth/verify-otp` | Verifies OTP and returns JWT. | No |
| **GET**  | `/api/auth/me` | Fetch authenticated user profile. | Yes (JWT) |
| **POST** | `/api/wallet/verify` | Bind MetaMask wallet to user via crypto sig. | Yes (JWT) |
| **GET**  | `/api/wallet/status` | Current wallet binding status. | Yes (JWT) |
| **GET**  | `/api/elections` | Fetch public election metadata. | No |
| **POST** | `/api/elections` | Create off-chain metadata (Admin). | Yes (Admin) |

---

## 📜 Smart Contract Reference (`VotingSystem.sol`)

| Function Signature | Access Control | Description |
| :--- | :--- | :--- |
| `createElection(name, desc, org)` | `onlyOwner` | Creates a new on-chain election. Returns unique `electionId`. |
| `addCandidate(electionId, name, desc)`| `onlyOwner` | Registers a candidate to a specific election window. |
| `openVoting(electionId)` | `onlyOwner` | Flags the election as active. Blocks new candidates. |
| `closeVoting(electionId)` | `onlyOwner` | Halts all incoming votes and finalizes the result state. |
| `registerSelf(electionId)` | `Public` | Enrolls sender as a Voter and **transfers 0.5 POL** to them. |
| `castVote(electionId, candidateId)` | `Registered` | Records an immutable vote for the chosen candidate. |
| `withdrawFunds()` | `onlyOwner` | Withdraws remaining contract funds back to the super admin. |

---

## 🚀 Installation & Local Development Guide

### Prerequisites
*   Node.js (v18+)
*   MySQL or PostgreSQL
*   MetaMask Extension (Connected to Polygon Amoy Testnet)
*   A Brevo API Key

### 1. Database & Backend Setup
```bash
cd backend
npm install
```
Create `.env` in the `/backend` directory:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306 # Use 5432 for Postgres
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=blockchain_voting_amoy
JWT_SECRET=your_super_secret_jwt_key
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=noreply@yourdomain.com
CLIENT_URL=http://localhost:5173
BLOCKCHAIN_NETWORK_URL=https://rpc-amoy.polygon.technology
```
```bash
# Start backend (Automatically syncs SQL tables)
node src/server.js
```

### 2. Smart Contract Deployment
```bash
cd blockchain
npm install
```
Create `.env` in the `/blockchain` directory:
```env
MNEMONIC="your twelve word metamask secret recovery phrase goes here"
```
```bash
# Deploy to Polygon Amoy (auto-funds the contract with 2 POL)
node deploy.js
```
*(Note: `deploy.js` successfully compiles the ABI and automatically injects `VotingSystem.json` into your React frontend folder!)*

### 3. Frontend Setup
```bash
cd Block-vote
npm install
```
Create `.env` in the `/Block-vote` directory:
```env
VITE_API_URL=http://localhost:5000/api
VITE_POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
VITE_POLYGONSCAN_API_KEY=your_polygonscan_api_key_optional
```
```bash
# Start the Vite Dev Server
npm run dev
```

---

## 🔒 Security Notice

> **⚠️ IMPORTANT:** Never commit real `.env` files. Each directory includes a `.env.example` with placeholder values. Copy it and fill in your own secrets:
> ```bash
> cp backend/.env.example backend/.env
> cp blockchain/.env.example blockchain/.env
> cp Block-vote/.env.example Block-vote/.env
> ```

---

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, development workflow, and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.