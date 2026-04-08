import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Wallet, RefreshCw } from 'lucide-react';
import { useWalletValidation } from '@/hooks/useWalletValidation';

interface WalletValidationAlertProps {
  className?: string;
}

export const WalletValidationAlert = ({ className }: WalletValidationAlertProps) => {
  const { 
    isValid, 
    isValidating, 
    connectedAddress, 
    registeredAddress, 
    error,
    forceValidation 
  } = useWalletValidation();

  // Don't show if wallet is valid or if we don't have enough info
  if (isValid || (!connectedAddress && !error)) {
    return null;
  }

  const handleRetryValidation = () => {
    forceValidation();
  };

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold">Wallet Validation Failed</h4>
            <p className="text-sm mt-1">
              {error === 'Wallet mismatch' ? (
                'Your connected wallet doesn\'t match your registered wallet address. Please switch to the correct wallet or update your profile.'
              ) : (
                error || 'Unable to validate wallet'
              )}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetryValidation}
              disabled={isValidating}
              className="bg-background"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry Validation
                </>
              )}
            </Button>
            
            {error === 'Wallet mismatch' && (
              <>
                <Button variant="outline" size="sm" asChild className="bg-background">
                  <a href="/profile">
                    <Wallet className="h-3 w-3 mr-1" />
                    Update Profile
                  </a>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (window.ethereum && registeredAddress) {
                      // Request to switch to registered address (this will open MetaMask)
                      window.ethereum.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }]
                      });
                    }
                  }}
                  className="bg-background"
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  Switch Wallet
                </Button>
              </>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};