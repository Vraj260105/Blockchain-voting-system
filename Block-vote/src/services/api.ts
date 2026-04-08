import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  LoginRequest,
  LoginResponse,
  VerifyLoginRequest,
  VerifyLoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ApiResponse,
  User,
  AuthTokens,
  WalletStatusResponse,
  WalletVerifyRequest,
  WalletVerifyResponse
} from '@/types/auth.types';

class APIService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const tokens = this.getTokens();
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh + error normalisation
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const refreshed = await this.refreshTokens();
            if (refreshed) {
              const tokens = this.getTokens();
              originalRequest.headers.Authorization = `Bearer ${tokens?.accessToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            this.clearAuth();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        
        // ── Normalise the error message so the UI never shows raw Axios text ──
        const friendlyMessage = this.extractErrorMessage(error);
        const normalised = new Error(friendlyMessage);
        (normalised as any).status = error.response?.status;
        (normalised as any).originalError = error;
        return Promise.reject(normalised);
      }
    );
  }

  /** Pull a human-readable message from an Axios error */
  private extractErrorMessage(error: any): string {
    // 1. Backend sent a JSON body with a message field
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    // 2. Backend sent a JSON body with an error field
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    // 3. Map common HTTP status codes to friendly text
    if (error.response?.status) {
      const map: Record<number, string> = {
        400: 'Invalid request — please check your input.',
        401: 'Session expired — please log in again.',
        403: 'You do not have permission to perform this action.',
        404: 'The requested resource was not found.',
        409: 'This action conflicts with existing data.',
        422: 'Validation failed — please check your input.',
        429: 'Too many requests — please wait and try again.',
        500: 'Server error — please try again later.',
        502: 'Server is temporarily unavailable.',
        503: 'Service maintenance in progress — try again shortly.',
      };
      return map[error.response.status] || `Request failed (${error.response.status}).`;
    }
    // 4. Network / timeout errors
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out — check your internet connection.';
    }
    if (error.message === 'Network Error') {
      return 'Cannot reach the server — check your internet connection or try again later.';
    }
    // 5. Fallback
    return error.message || 'An unexpected error occurred.';
  }

  // Local storage management
  private getTokens(): AuthTokens | null {
    try {
      const tokens = localStorage.getItem('tokens');
      return tokens ? JSON.parse(tokens) : null;
    } catch {
      return null;
    }
  }

  private getUser(): User | null {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  private setAuth(user: User, tokens: AuthTokens): void {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tokens', JSON.stringify(tokens));
  }

  public clearAuth(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('tokens');
  }

  // Authentication APIs
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response: AxiosResponse<LoginResponse> = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async verifyLogin(otpData: VerifyLoginRequest): Promise<VerifyLoginResponse> {
    const response: AxiosResponse<VerifyLoginResponse> = await this.api.post('/auth/verify-login', otpData);
    if (response.data.success && response.data.data) {
      this.setAuth(response.data.data.user, response.data.data.tokens);
    }
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    const response: AxiosResponse<RegisterResponse> = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async verifyEmail(otpData: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    const response: AxiosResponse<VerifyEmailResponse> = await this.api.post('/auth/verify-email', otpData);
    if (response.data.success && response.data.data) {
      this.setAuth(response.data.data.user, response.data.data.tokens);
    }
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    const response: AxiosResponse<ApiResponse<{ user: User }>> = await this.api.get('/auth/me');
    return response.data;
  }

  async updateProfile(profileData: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    const response: AxiosResponse<UpdateProfileResponse> = await this.api.put('/users/profile', profileData);
    if (response.data.success && response.data.data) {
      const updatedUser = response.data.data.user;
      const tokens = this.getTokens();
      if (tokens) {
        this.setAuth(updatedUser, tokens);
      }
    }
    return response.data;
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const response: AxiosResponse<ForgotPasswordResponse> = await this.api.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(resetData: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const response: AxiosResponse<ResetPasswordResponse> = await this.api.post('/auth/reset-password', resetData);
    return response.data;
  }

  async logout(): Promise<ApiResponse> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.api.post('/auth/logout');
      this.clearAuth();
      return response.data;
    } catch (error) {
      // Clear auth even if API call fails
      this.clearAuth();
      throw error;
    }
  }

  async refreshTokens(): Promise<boolean> {
    try {
      const tokens = this.getTokens();
      if (!tokens?.refreshToken) {
        return false;
      }

      const response: AxiosResponse<ApiResponse<{ tokens: AuthTokens }>> = await this.api.post('/auth/refresh', {
        refreshToken: tokens.refreshToken
      });

      if (response.data.success && response.data.data) {
        const user = this.getUser();
        if (user) {
          this.setAuth(user, response.data.data.tokens);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // Wallet APIs
  async getWalletStatus(): Promise<WalletStatusResponse> {
    const response: AxiosResponse<WalletStatusResponse> = await this.api.get('/wallet/status');
    return response.data;
  }

  async verifyWallet(walletData: WalletVerifyRequest): Promise<WalletVerifyResponse> {
    const response: AxiosResponse<WalletVerifyResponse> = await this.api.post('/wallet/verify', walletData);
    return response.data;
  }

  // Utility methods
  isAuthenticated(): boolean {
    const user = this.getUser();
    const tokens = this.getTokens();
    return !!(user && tokens);
  }

  getCurrentUserData(): User | null {
    return this.getUser();
  }

  getCurrentTokens(): AuthTokens | null {
    return this.getTokens();
  }
}

// Create and export singleton instance
const apiService = new APIService();
export default apiService;