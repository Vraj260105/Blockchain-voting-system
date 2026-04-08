# Contributing to Multi-Election Blockchain Voting System

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## 🏗️ Project Setup

Please refer to the [README.md](README.md) for full installation and local development instructions.

## 🔧 Development Workflow

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/blockchain-voting-system.git
   cd blockchain-voting-system
   ```
3. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes.** Follow the coding standards below.
5. **Commit** with a clear, descriptive message:
   ```bash
   git commit -m "feat: add voter turnout chart to results page"
   ```
6. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** on the main repository.

## 📝 Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

| Prefix   | Use Case                                  |
| :------- | :---------------------------------------- |
| `feat:`  | A new feature                             |
| `fix:`   | A bug fix                                 |
| `docs:`  | Documentation changes only                |
| `style:` | CSS / formatting (no logic changes)       |
| `refactor:` | Code restructuring (no new features or fixes) |
| `test:`  | Adding or updating tests                  |
| `chore:` | Build scripts, dependencies, tooling      |

## 🧹 Coding Standards

### Frontend (`Block-vote/`)
- Use **TypeScript** for all new components and hooks.
- Use **functional components** with React hooks.
- Follow existing patterns in `services/web3.ts` for blockchain interactions.
- All user-facing errors must be surfaced via `sonner` toasts, not `console.error` alone.

### Backend (`backend/`)
- Use `async/await` over raw Promises.
- Add proper error handling with descriptive HTTP status codes.
- Protect sensitive routes with the `auth` and `roleGuard` middleware.

### Smart Contracts (`blockchain/`)
- Target Solidity `^0.8.20`.
- All public/external functions must include `require()` guards.
- Emit events for every state-changing operation.

## ⚠️ Important Notes

- **Never commit `.env` files.** Use `.env.example` as your reference.
- **Never commit `node_modules/`.** The root `.gitignore` handles this.
- **Test on Polygon Amoy Testnet** before submitting contract changes.
- **Run the frontend build** (`npm run build` in `Block-vote/`) to catch TypeScript errors before submitting.

## 📄 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
