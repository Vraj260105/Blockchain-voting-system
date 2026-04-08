import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, AlertCircle, Vote } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  
  const { forgotPassword, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const validated = forgotPasswordSchema.parse({ email });
      
      const response = await forgotPassword(validated.email);
      setMaskedEmail(response.maskedEmail || email);
      setIsSubmitted(true);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError((err as Error).message || 'Failed to send reset email. Please try again.');
      }
    }
  };

  const handleProceedToReset = () => {
    navigate('/reset-password', { state: { email } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Vote className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Reset Your Password
          </h1>
          <p className="text-muted-foreground">
            {isSubmitted 
              ? "We'll send you a code to reset your password"
              : "Enter your email address and we'll send you a reset code"
            }
          </p>
        </div>

        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>
              {isSubmitted ? 'Check Your Email' : 'Forgot Password'}
            </CardTitle>
            <CardDescription>
              {isSubmitted 
                ? `We've sent a 6-digit code to ${maskedEmail}`
                : 'Enter your email address to receive a reset code'
              }
            </CardDescription>
          </CardHeader>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
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
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full shadow-elegant"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    'Send Reset Code'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  asChild
                  className="w-full"
                >
                  <Link to="/login">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                  </Link>
                </Button>
              </CardFooter>
            </form>
          ) : (
            <CardContent className="space-y-4">
              <div className="text-center py-6">
                <Mail className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground mb-6">
                  Please check your email and click the button below when you're ready to enter the reset code.
                </p>
                
                <div className="space-y-3">
                  <Button
                    onClick={handleProceedToReset}
                    className="w-full shadow-elegant"
                  >
                    I Have the Code - Reset Password
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setIsSubmitted(false)}
                    className="w-full"
                  >
                    Use Different Email
                  </Button>
                  
                  <Button
                    variant="ghost"
                    asChild
                    className="w-full"
                  >
                    <Link to="/login">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Login
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}