import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { User, Mail, Wallet, Save, AlertCircle, CheckCircle2, Shield, Send, Key } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { z } from 'zod';
import apiService from '@/services/api';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username too long').optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address').optional().or(z.literal('')),
});

const verificationSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
});

export default function ProfilePage() {
  const { user, updateProfile, verifyEmail } = useAuth();
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    walletAddress: user?.walletAddress || '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Email verification states
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const validated = profileSchema.parse(formData);
      setIsLoading(true);

      await updateProfile(validated);
      setIsEditing(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      username: user?.username || '',
      walletAddress: user?.walletAddress || '',
    });
    setIsEditing(false);
    setError('');
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleIcon = () => {
    return <Shield className="h-3 w-3 mr-1" />;
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    
    setIsResending(true);
    setVerificationError('');
    setVerificationSuccess('');
    
    try {
      // Call backend to resend verification email (create new OTP)
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${baseURL}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMaskedEmail(data.data?.maskedEmail || user.email);
        setVerificationSuccess('Verification code sent to your email!');
      } else {
        // If endpoint doesn't exist, try using register endpoint as fallback
        const registerResponse = await apiService.register({
          email: user.email,
          password: 'dummy',
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: user.walletAddress
        });
        
        if (registerResponse.success) {
          setMaskedEmail(registerResponse.data?.maskedEmail || user.email);
          setVerificationSuccess('Verification code sent to your email!');
        } else {
          setVerificationError('User already exists. Please check if your email is already verified.');
        }
      }
    } catch (error: any) {
      // Fallback: try register endpoint if resend endpoint doesn't exist
      try {
        const registerResponse = await apiService.register({
          email: user.email,
          password: 'dummy',
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: user.walletAddress
        });
        
        if (registerResponse.success) {
          setMaskedEmail(registerResponse.data?.maskedEmail || user.email);
          setVerificationSuccess('Verification code sent to your email!');
        } else {
          setVerificationError('User already exists. If you are registered, your email may already be verified.');
        }
      } catch (fallbackError: any) {
        setVerificationError('Failed to send verification email. Please try again later.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    
    setIsVerifying(true);
    setVerificationError('');
    
    try {
      const validated = verificationSchema.parse({ otp });
      
      await verifyEmail({ email: user.email, code: validated.otp });
      setShowVerificationDialog(false);
      setOtp('');
      setSuccess('Email verified successfully!');
    } catch (err) {
      if (err instanceof z.ZodError) {
        setVerificationError(err.errors[0].message);
      } else {
        setVerificationError((err as Error).message || 'Verification failed');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCloseVerificationDialog = () => {
    setShowVerificationDialog(false);
    setOtp('');
    setVerificationError('');
    setVerificationSuccess('');
    setMaskedEmail('');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="animate-slide-up">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
            <p className="text-muted-foreground">
              Manage your account information and preferences
            </p>
          </div>

          {success && (
            <Alert className="mb-6 border-success/50 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">{success}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Your personal details and blockchain wallet information
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={user?.email}
                    disabled
                    className="pl-10 bg-muted/50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              {user?.lastLogin && (
                <div className="space-y-2">
                  <Label>Last Login</Label>
                  <p className="text-sm font-medium text-muted-foreground">
                    {new Date(user.lastLogin).toLocaleString()}
                  </p>
                </div>
              )}

              <Separator />

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={handleChange}
                      disabled={!isEditing || isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={handleChange}
                      disabled={!isEditing || isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleChange}
                      className="pl-10"
                      disabled={!isEditing || isLoading}
                      placeholder="Choose a username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Ethereum Wallet Address</Label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="walletAddress"
                      name="walletAddress"
                      type="text"
                      value={formData.walletAddress}
                      onChange={handleChange}
                      className="pl-10 font-mono text-sm"
                      disabled={!isEditing || isLoading}
                      placeholder="0x..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connect your MetaMask wallet for blockchain voting
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  {!isEditing ? (
                    <Button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="shadow-elegant"
                    >
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="shadow-elegant"
                      >
                        {isLoading ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-card mt-6">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account status and role in Block-Vote</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">User Role</span>
                <Badge variant={getRoleBadgeVariant(user?.role)} className="font-medium">
                  {getRoleIcon()}
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email Verified</span>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${user?.isVerified ? 'text-success' : 'text-warning'}`}>
                    {user?.isVerified ? '✓ Verified' : '⚠ Not Verified'}
                  </span>
                  {!user?.isVerified && (
                    <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs"
                          onClick={() => setShowVerificationDialog(true)}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Verify Now
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Verify Your Email</DialogTitle>
                          <DialogDescription>
                            Enter the 6-digit verification code sent to your email address
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          {verificationError && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{verificationError}</AlertDescription>
                            </Alert>
                          )}
                          
                          {verificationSuccess && (
                            <Alert className="border-success/50 bg-success/10">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              <AlertDescription className="text-success">{verificationSuccess}</AlertDescription>
                            </Alert>
                          )}
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-4">
                              {maskedEmail ? `Code sent to ${maskedEmail}` : `We'll send a code to ${user?.email}`}
                            </p>
                            
                            <Button
                              onClick={handleResendVerification}
                              disabled={isResending}
                              variant="outline"
                              size="sm"
                              className="mb-4"
                            >
                              {isResending ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <>
                                  <Send className="h-3 w-3 mr-2" />
                                  {maskedEmail ? 'Resend Code' : 'Send Code'}
                                </>
                              )}
                            </Button>
                          </div>
                          
                          <form onSubmit={handleVerifyEmail} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="verification-otp">Verification Code</Label>
                              <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="verification-otp"
                                  type="text"
                                  placeholder="123456"
                                  value={otp}
                                  onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                                  className="pl-10 text-center text-2xl tracking-widest"
                                  maxLength={6}
                                  required
                                  disabled={isVerifying}
                                />
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                type="submit"
                                disabled={isVerifying || otp.length !== 6}
                                className="flex-1"
                              >
                                {isVerifying ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  'Verify Email'
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseVerificationDialog}
                                disabled={isVerifying}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm font-medium">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
