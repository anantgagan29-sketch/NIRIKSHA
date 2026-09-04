import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AccessibilityProvider } from "@/hooks/useAccessibility";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { LanguageProvider } from "@/hooks/useLanguage";
import { SelectedProductProvider } from "@/hooks/useSelectedProduct";
import { ToastProvider } from "@/components/ui/Toast";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { CursorGlow } from "@/components/ui/CursorGlow";
import { Dashboard } from "@/pages/Dashboard";
import { Inspect } from "@/pages/Inspect";
import { ScanResult } from "@/pages/ScanResult";
import { Compliance } from "@/pages/Compliance";
import { Reports } from "@/pages/Reports";
import { Complaints } from "@/pages/Complaints";
import { History } from "@/pages/History";
import { HowItWorks } from "@/pages/HowItWorks";
import { Admin } from "@/pages/Admin";
import { Settings } from "@/pages/Settings";
import { NotFound } from "@/pages/NotFound";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { ForgotPassword } from "@/pages/auth/ForgotPassword";

export default function App() {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
      <LanguageProvider>
        <AuthProvider>
        <SelectedProductProvider>
          <ToastProvider>
            <SplashScreen />
              <CursorGlow />

              <BrowserRouter>
              <Routes>
                {/* Account screens stand alone: full-page, no console chrome. */}
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="forgot-password" element={<ForgotPassword />} />

                <Route element={<AppShell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="inspect" element={<Inspect />} />
                  <Route path="scan-result" element={<ScanResult />} />
                  <Route path="scan-result/:scanId" element={<ScanResult />} />
                  <Route path="compliance" element={<Compliance />} />
                  {/* With a scan id, the stored scan is loaded rather than the
                      current selection — this is what History links to. */}
                  <Route path="compliance/:scanId" element={<Compliance />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="complaints" element={<Complaints />} />
                  <Route path="history" element={<History />} />
                  <Route path="how-it-works" element={<HowItWorks />} />
                  <Route
                    path="admin"
                    element={
                      <RequireAuth role="authority">
                        <Admin />
                      </RequireAuth>
                    }
                  />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </SelectedProductProvider>
        </AuthProvider>
      </LanguageProvider>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}
