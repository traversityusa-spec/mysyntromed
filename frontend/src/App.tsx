import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/ui/ChatWidget";
import { ToastContainer } from "@/components/ui/Toast";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardHome from "@/components/dashboard/DashboardHome";
import Messages from "@/components/dashboard/Messages";
import Requests from "@/components/dashboard/Requests";
import Specialist from "@/components/dashboard/Specialist";
import Activity from "@/components/dashboard/Activity";
import Calls from "@/components/dashboard/Calls";
import Settings from "@/components/dashboard/Settings";
import { AdminClients, AdminSpecialists, AdminConversations, AdminAnalytics } from "@/components/dashboard/AdminPages";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import HowItWorks from "@/pages/HowItWorks";
import ClientPortal from "@/pages/ClientPortal";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import PortalAuth from "@/pages/PortalAuth";
import AdminAuth from "@/pages/AdminAuth";
import SpecialistAuth from "@/pages/SpecialistAuth";
import ResetPassword from "@/pages/ResetPassword";

const MarketingLayout = ({ children }: { children: ReactNode }) => (
  <>
    <Navbar />
    <main className="flex-grow">{children}</main>
    <Footer />
    <ChatWidget />
  </>
);

const AuthRoute = ({ children }: { children: ReactNode }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, sessionUser, loading } = useAuth();

  const isReady = !loading && !!sessionUser;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (sessionUser.isNewUser) {
    return <Navigate to="/reset-password" replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, sessionUser, loading } = useAuth();

  const isReady = !loading && !!sessionUser;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-front border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (sessionUser.isNewUser) {
    return <Navigate to="/reset-password" replace />;
  }

  if (sessionUser.role !== 'admin') return <Navigate to="/portal/dashboard" replace />;
  return <>{children}</>;
};

const SpecialistRoute = ({ children }: { children: ReactNode }) => {
  const { user, sessionUser, loading } = useAuth();

  const isReady = !loading && !!sessionUser;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (sessionUser.isNewUser) {
    return <Navigate to="/reset-password" replace />;
  }

  if (sessionUser.role !== 'specialist') return <Navigate to="/portal/dashboard" replace />;
  return <>{children}</>;
};

const ResetPasswordRoute = ({ children }: { children: ReactNode }) => {
  const { user, sessionUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!user || !sessionUser) return <Navigate to="/portal" replace />;
  return <>{children}</>;
};

const DashboardPage = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DashboardLayout>
  </ProtectedRoute>
);

const AdminPage = ({ children }: { children: ReactNode }) => (
  <AdminRoute>
    <DashboardLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DashboardLayout>
  </AdminRoute>
);

const SpecialistPage = ({ children }: { children: ReactNode }) => (
  <SpecialistRoute>
    <DashboardLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DashboardLayout>
  </SpecialistRoute>
);


function AppRoutes() {
  const location = useLocation();
  const { devLoginAs } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    (window as unknown as { devLoginAs?: typeof devLoginAs }).devLoginAs = devLoginAs;
  }, [devLoginAs]);

  return (
    <Routes location={location}>
      <Route path="/" element={<MarketingLayout><Home /></MarketingLayout>} />
      <Route path="/about" element={<MarketingLayout><About /></MarketingLayout>} />
      <Route path="/services" element={<MarketingLayout><Services /></MarketingLayout>} />
      <Route path="/how-it-works" element={<MarketingLayout><HowItWorks /></MarketingLayout>} />
      <Route path="/client-portal" element={<MarketingLayout><ClientPortal /></MarketingLayout>} />
      <Route path="/faq" element={<MarketingLayout><FAQ /></MarketingLayout>} />
      <Route path="/contact" element={<MarketingLayout><Contact /></MarketingLayout>} />
      <Route path="/careers" element={<Navigate to="/" replace />} />

      {/* Auth entry points */}
      <Route path="/portal" element={<AuthRoute><PortalAuth /></AuthRoute>} />
      <Route path="/admin" element={<AuthRoute><AdminAuth /></AuthRoute>} />
      <Route path="/specialist" element={<AuthRoute><SpecialistAuth /></AuthRoute>} />
      <Route path="/reset-password" element={<ResetPasswordRoute><ResetPassword /></ResetPasswordRoute>} />
      
       {/* Client Workspace */}

       <Route path="/portal/dashboard" element={<DashboardPage><DashboardHome /></DashboardPage>} />
       <Route path="/portal/messages" element={<DashboardPage><Messages /></DashboardPage>} />
       <Route path="/portal/calls" element={<DashboardPage><Calls /></DashboardPage>} />
       <Route path="/portal/requests" element={<DashboardPage><Requests /></DashboardPage>} />
       <Route path="/portal/specialist" element={<DashboardPage><Specialist /></DashboardPage>} />
       <Route path="/portal/activity" element={<DashboardPage><Activity /></DashboardPage>} />
       <Route path="/portal/settings" element={<DashboardPage><Settings /></DashboardPage>} />
      
      {/* Admin Workspace */}
      <Route path="/admin/dashboard" element={<AdminPage><AdminDashboard /></AdminPage>} />
      <Route path="/admin/clients" element={<AdminPage><AdminClients /></AdminPage>} />
      <Route path="/admin/specialists" element={<AdminPage><AdminSpecialists /></AdminPage>} />
      <Route path="/admin/messages" element={<AdminPage><Messages /></AdminPage>} />
      <Route path="/admin/conversations" element={<AdminPage><AdminConversations /></AdminPage>} />
      <Route path="/admin/analytics" element={<AdminPage><AdminAnalytics /></AdminPage>} />
      <Route path="/admin/settings" element={<AdminPage><Settings /></AdminPage>} />

       {/* Specialist Workspace */}
       <Route path="/specialist/dashboard" element={<SpecialistPage><DashboardHome /></SpecialistPage>} />
       <Route path="/specialist/messages" element={<SpecialistPage><Messages /></SpecialistPage>} />
       <Route path="/specialist/calls" element={<SpecialistPage><Calls /></SpecialistPage>} />
       <Route path="/specialist/requests" element={<SpecialistPage><Requests /></SpecialistPage>} />
       <Route path="/specialist/activity" element={<SpecialistPage><Activity /></SpecialistPage>} />
       <Route path="/specialist/settings" element={<SpecialistPage><Settings /></SpecialistPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col relative selection:bg-teal-100 selection:text-teal-900">
        <AppRoutes />
        <ToastContainer />
      </div>
    </AuthProvider>
  );
}
