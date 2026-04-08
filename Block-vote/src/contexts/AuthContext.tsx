import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  User,
  AuthTokens,
  LoginRequest,
  VerifyLoginRequest,
  RegisterRequest,
  VerifyEmailRequest,
  UpdateProfileRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '@/types/auth.types';
import apiService from '@/services/api';
import web3Service from '@/services/web3';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; tokens: AuthTokens } }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'REFRESH_TOKEN'; payload: AuthTokens };

interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<{ needsOTP: boolean; maskedEmail?: string }>;
  verifyLogin: (otpData: VerifyLoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<{ needsOTP: boolean; maskedEmail?: string }>;
  verifyEmail: (otpData: VerifyEmailRequest) => Promise<void>;
  logout: (silent?: boolean) => Promise<void>;
  updateProfile: (profileData: UpdateProfileRequest) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ maskedEmail?: string }>;
  resetPassword: (resetData: ResetPasswordRequest) => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'REFRESH_TOKEN':
      return {
        ...state,
        tokens: action.payload,
      };
    default:
      return state;
  }
};

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // Initialize auth state from localStorage and verify with backend
    const initializeAuth = async () => {
      try {
        const storedUser = apiService.getCurrentUserData();
        const storedTokens = apiService.getCurrentTokens();
        
        if (storedUser && storedTokens) {
          // Verify tokens are still valid by fetching current user
          try {
            const response = await apiService.getCurrentUser();
            if (response.success && response.data?.user) {
              dispatch({ 
                type: 'LOGIN_SUCCESS', 
                payload: { user: response.data.user, tokens: storedTokens } 
              });
              return;
            }
          } catch (error) {
            // Token might be invalid, clear storage
            apiService.clearAuth();
          }
        }
        
        dispatch({ type: 'SET_LOADING', payload: false });
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials: LoginRequest): Promise<{ needsOTP: boolean; maskedEmail?: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.login(credentials);
      
      if (response.success) {
        return {
          needsOTP: true,
          maskedEmail: response.data?.maskedEmail
        };
      }
      
      throw new Error(response.message);
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Verify login OTP
  const verifyLogin = async (otpData: VerifyLoginRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.verifyLogin(otpData);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, tokens } });
        toast.success('Login successful! Welcome back.');
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'OTP verification failed');
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Register function
  const register = async (userData: RegisterRequest): Promise<{ needsOTP: boolean; maskedEmail?: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.register(userData);
      
      if (response.success) {
        return {
          needsOTP: true,
          maskedEmail: response.data?.maskedEmail
        };
      }
      
      throw new Error(response.message);
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Verify email OTP
  const verifyEmail = async (otpData: VerifyEmailRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.verifyEmail(otpData);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, tokens } });
        toast.success('Email verified successfully! Welcome to the platform.');
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Email verification failed');
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Logout function
  const logout = async (silent = false): Promise<void> => {
    try {
      await apiService.logout();
      dispatch({ type: 'LOGOUT' });
      if (!silent) toast.success('Logged out successfully');
    } catch (error: any) {
      // Still clear local auth even if API call fails
      dispatch({ type: 'LOGOUT' });
      console.error('Logout error:', error);
    }
  };

  // Update profile
  const updateProfile = async (profileData: UpdateProfileRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.updateProfile(profileData);
      
      if (response.success && response.data?.user) {
        dispatch({ type: 'UPDATE_USER', payload: response.data.user });
        toast.success('Profile updated successfully!');
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Profile update failed');
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Forgot password
  const forgotPassword = async (email: string): Promise<{ maskedEmail?: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.forgotPassword(email);
      
      if (response.success) {
        toast.success(response.message);
        return { maskedEmail: response.data?.maskedEmail };
      }
      
      throw new Error(response.message);
    } catch (error: any) {
      toast.error(error.message || 'Password reset request failed');
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Reset password
  const resetPassword = async (resetData: ResetPasswordRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.resetPassword(resetData);
      
      if (response.success) {
        toast.success('Password reset successfully! You can now login with your new password.');
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Password reset failed');
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Refresh token
  const refreshTokens = async (): Promise<boolean> => {
    try {
      const success = await apiService.refreshTokens();
      if (success) {
        const newTokens = apiService.getCurrentTokens();
        if (newTokens) {
          dispatch({ type: 'REFRESH_TOKEN', payload: newTokens });
        }
      }
      return success;
    } catch (error) {
      dispatch({ type: 'LOGOUT' });
      return false;
    }
  };

  // Set user (for internal use)
  const setUser = (user: User) => {
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        verifyLogin,
        register,
        verifyEmail,
        logout,
        updateProfile,
        forgotPassword,
        resetPassword,
        refreshTokens,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
