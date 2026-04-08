import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { Navigation } from "@/components/Navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WalletMonitor } from "@/components/WalletMonitor";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import ElectionsPage from "./pages/ElectionsPage";
import VotingPage from "./pages/VotingPage";
import AdminPage from "./pages/AdminPage";
import ElectionResultsPage from "./pages/ElectionResultsPage";
import TransactionHistoryPage from "./pages/TransactionHistoryPage";
import ContactPage from "./pages/ContactPage";
import PublicElectionsPage from "./pages/PublicElectionsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark">
      <TooltipProvider>
        <AuthProvider>
          <WalletMonitor />
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <Navigation />
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            {/* Elections list */}
            <Route
              path="/elections"
              element={
                <ProtectedRoute>
                  <ElectionsPage />
                </ProtectedRoute>
              }
            />
            {/* Single election voting page */}
            <Route
              path="/voting/:electionId"
              element={
                <ProtectedRoute>
                  <VotingPage />
                </ProtectedRoute>
              }
            />
            {/* Admin Dashboard (owner-only) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            {/* Public results page — no login required */}
            <Route path="/elections/:electionId/results" element={<ElectionResultsPage />} />
            {/* Public directory of all elections */}
            <Route path="/public-results" element={<PublicElectionsPage />} />
            {/* Transaction history — protected */}
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <TransactionHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route path="/contact" element={<ContactPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
