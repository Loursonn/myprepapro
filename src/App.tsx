import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute, { RoleRedirect } from "@/components/ProtectedRoute";
import Login from "./pages/Login.tsx";
import InviteAccept from "./pages/InviteAccept.tsx";
import NotFound from "./pages/NotFound.tsx";
import CoachDashboard from "./pages/coach/Dashboard.tsx";
import AthleteDashboard from "./pages/athlete/Dashboard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Pages publiques */}
            <Route path="/login" element={<Login />} />
            <Route path="/invite/:token" element={<InviteAccept />} />

            {/* Redirection selon le rôle */}
            <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

            {/* Vue coach */}
            <Route path="/coach" element={<ProtectedRoute><CoachDashboard /></ProtectedRoute>} />

            {/* Vue athlète */}
            <Route path="/athlete" element={<ProtectedRoute><AthleteDashboard /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
