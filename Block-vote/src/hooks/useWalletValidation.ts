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
    isValid: false,
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
          isValid: false,
          error: 'No wallet connected'
        }));
        
        if (forceLogout) {
          toast.error('No wallet connected. Please connect MetaMask.');
          logout();
        }
        return { isValid: false, message: 'No wallet connected' };
      }

      // Get registered wallet address from backend
      const walletStatus = await apiService.getWalletStatus();
      if (!walletStatus.success || !walletStatus.data.hasWallet) {
        setState(prev => ({ 
          ...prev, 
          isValidating: false,
          isValid: false,
          connectedAddress,
          error: 'No wallet registered'
        }));
        
        if (forceLogout) {
          toast.error('Please register a wallet address in your profile.');
          logout();
        }
        return { isValid: false, message: 'No wallet registered' };
      }

      const registeredAddress = walletStatus.data.walletAddress;
      
      // Compare addresses (case-insensitive)
      const isMatching = connectedAddress.toLowerCase() === registeredAddress?.toLowerCase();
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        isValid: isMatching,
        connectedAddress,
        registeredAddress,
        error: isMatching ? null : 'Wallet mismatch'
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
      setState(prev => ({ 
        ...prev, 
        isValidating: false, 
        isValid: false,
        error: error.message || 'Validation failed'
      }));
      
      if (forceLogout) {
        toast.error('Wallet validation failed. Please try again.');
        logout();
      }
      return { isValid: false, message: error.message || 'Validation failed' };
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