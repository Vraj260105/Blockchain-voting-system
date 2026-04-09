import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import web3Service from '@/services/web3';
import apiService from '@/services/api';
import { toast } from 'sonner';

interface WalletValidationState {
  isValidating: boolean;
  isValid: boolean;
  connectedAddress: string;
  registeredAddress: string | null;
  error: string | null;
}

export const useWalletValidation = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [state, setState] = useState<WalletValidationState>({
    isValidating: false,
    isValid: true,       // ✅ Assume valid until we actually finish checking
    connectedAddress: '',
    registeredAddress: null,
    error: null,
  });

  const validateWallet = useCallback(async (forceLogout = true) => {
    if (!isAuthenticated || !user) {
      return { isValid: true, message: 'Not authenticated' };
    }

    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      // Get connected wallet address
      const connectedAddress = web3Service.getAccount();
      if (!connectedAddress) {
        setState(prev => ({ 
          ...prev, 
          isValidating: false, 
          isValid: true,   // ✅ No wallet in MetaMask — let them through, web3 guard handles this
          error: 'No wallet connected'
        }));
        return { isValid: true, message: 'No wallet connected' };
      }

      // Get registered wallet address from backend
      const walletStatus = await apiService.getWalletStatus();

      // ✅ If user hasn't registered a wallet yet — don't block them
      // The mismatch check only makes sense when they HAVE registered one
      if (!walletStatus.success || !walletStatus.data?.hasWallet || !walletStatus.data?.walletAddress) {
        setState(prev => ({ 
          ...prev, 
          isValidating: false,
          isValid: true,     // ✅ No registered wallet = no mismatch to detect
          connectedAddress,
          registeredAddress: null,
          error: null,
        }));
        return { isValid: true, message: 'No wallet registered — skipping check' };
      }

      const registeredAddress = walletStatus.data.walletAddress;
      
      // Compare addresses (case-insensitive)
      const isMatching = connectedAddress.toLowerCase() === registeredAddress.toLowerCase();
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        isValid: isMatching,
        connectedAddress,
        registeredAddress,
        error: isMatching ? null : 'The connected MetaMask wallet does not match your registered wallet address.',
      }));

      if (!isMatching && forceLogout) {
        toast.error('Wallet mismatch detected!', {
          description: 'Please switch to your registered wallet address or update your profile.'
        });
        logout();
        return { isValid: false, message: 'Wallet address mismatch' };
      }

      return { 
        isValid: isMatching, 
        message: isMatching ? 'Wallet validated' : 'Wallet address mismatch'
      };

    } catch (error: any) {
      console.error('Wallet validation error:', error);
      // ✅ On API error, don't block the user — just log it quietly
      setState(prev => ({ 
        ...prev, 
        isValidating: false, 
        isValid: true,    // ✅ Fail open on network errors — don't punish user
        error: null,
      }));
      return { isValid: true, message: 'Validation skipped due to error' };
    }
  }, [isAuthenticated, user, logout]);

  // Validate wallet on mount and when auth state changes
  useEffect(() => {
    if (isAuthenticated && web3Service.isInitialized()) {
      validateWallet(false); // Don't force logout on initial check
    }
  }, [isAuthenticated, validateWallet]);

  // Listen for account changes in MetaMask
  useEffect(() => {
    const handleAccountChange = async (accounts: string[]) => {
      if (!isAuthenticated) return;

      if (accounts.length === 0) {
        toast.error('Wallet disconnected. Please reconnect.');
        logout();
        return;
      }

      // Logout first to clear auth session, then refresh
      toast.warning('Wallet switched — please log in again.', {
        description: 'Your session has been ended for security.',
        duration: 4000,
      });
      await logout(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 800);
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountChange);
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountChange);
      };
    }
  }, [isAuthenticated, validateWallet, logout]);

  return {
    ...state,
    validateWallet,
    forceValidation: () => validateWallet(true),
  };
};