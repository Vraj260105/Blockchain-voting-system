import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Vote } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password too long'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
});

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState('');
  
  const { login, verifyLogin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/elections';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const validated = loginSchema.parse({ email, password });
      
      const response = await login(validated);
      if (response.needsOTP && response.maskedEmail) {
        setMaskedEmail(response.maskedEmail);
        setShowOtpStep(true);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError((err as Error).message || 'Login failed. Please check your credentials.');
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const validated = otpSchema.parse({ otp });
      
      await verifyLogin({ email, code: validated.otp });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError((err as Error).message || 'Invalid OTP. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Vote className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Welcome Back to Block-Vote
          </h1>
          <p className="text-muted-foreground">
            Sign in to access the blockchain voting platform
          </p>
        </div>

        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>{showOtpStep ? 'Verify OTP' : 'Sign In'}</CardTitle>
            <CardDescription>
              {showOtpStep 
                ? `Enter the 6-digit code sent to ${maskedEmail || email}`
                : 'Enter your credentials to continue'
              }
            </CardDescription>
          </CardHeader>

          <form onSubmit={showOtpStep ? handleVerifyOtp : handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!showOtpStep ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={authLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        disabled={authLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="otp">One-Time Password</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                    required
                    disabled={authLoading}
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full shadow-elegant"
                disabled={authLoading}
              >
                {authLoading ? (
                  <LoadingSpinner size="sm" />
                ) : showOtpStep ? (
                  'Verify & Sign In'
                ) : (
                  'Continue'
                )}
              </Button>

              {showOtpStep && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowOtpStep(false)}
                  disabled={authLoading}
                  className="w-full"
                >
                  Back to Login
                </Button>
              )}

              {!showOtpStep && (
                <>
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-center text-primary hover:underline font-medium block"
                  >
                    Forgot your password?
                  </Link>
                  <p className="text-sm text-center text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-primary hover:underline font-medium">
                      Sign up
                    </Link>
                  </p>
                </>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
