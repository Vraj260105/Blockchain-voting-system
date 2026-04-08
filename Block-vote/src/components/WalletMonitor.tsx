import { useWalletValidation } from '@/hooks/useWalletValidation';

/**
 * WalletMonitor component that silently monitors wallet changes
 * and triggers auto-refresh when wallet is changed after login
 */
export const WalletMonitor = () => {
  // This hook will monitor wallet changes and auto-refresh
  useWalletValidation();
  
  // This component doesn't render anything
  return null;
};