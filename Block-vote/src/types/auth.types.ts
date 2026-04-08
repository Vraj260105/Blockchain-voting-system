// User and authentication types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  role: 'super_admin' | 'election_admin' | 'voter';
  walletAddress?: string;
  isVerified: boolean;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    maskedEmail: string;
    preview?: string;
  };
}

export interface VerifyLoginRequest {
  email: string;
  code: string;
}

export interface VerifyLoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    tokens: AuthTokens;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  walletAddress?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    maskedEmail: string;
    preview?: string;
  };
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    tokens: AuthTokens;
  };
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  walletAddress?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    maskedEmail: string;
  };
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface WalletStatusResponse {
  success: boolean;
  data: {
    hasWallet: boolean;
    walletAddress?: string;
  };
}

export interface WalletVerifyRequest {
  walletAddress: string;
}

export interface WalletVerifyResponse {
  success: boolean;
  data: {
    isMatching: boolean;
    message: string;
  };
}

// Blockchain specific types
export interface Election {
  id: number;
  name: string;
  description: string;
  organizationName: string;
  scheduledStart: number;   // 0 = no scheduled start
  scheduledEnd: number;     // 0 = no scheduled end
  startTime: number;        // actual open timestamp
  endTime: number;          // actual close timestamp
  isActive: boolean;
  totalVotes: number;
  candidateCount: number;
}

export interface ElectionScheduleStatus {
  shouldOpen: boolean;
  shouldClose: boolean;
  currentTime: number;
}

export interface Candidate {
  id: number;
  name: string;
  description: string;
  votes: number;
}

export interface VoterInfo {
  isRegistered: boolean;
  hasVoted: boolean;
  votedCandidateId?: number;
}

export interface ContractData {
  address: string;
  abi: any;
}

export interface WalletAuthStatus {
  hasWallet: boolean;
  isVerified: boolean;
  message: string;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface UpdateProfilePayload {
  username?: string;
  firstName?: string;
  lastName?: string;
  walletAddress?: string;
}
