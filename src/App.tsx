import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import LoginPage from "@/pages/Login";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Sell = lazy(() => import("@/pages/Sell"));
const Sales = lazy(() => import("@/pages/Sales"));
const SaleDetail = lazy(() => import("@/pages/SaleDetail"));
const Purchase = lazy(() => import("@/pages/Purchase"));
const Purchases = lazy(() => import("@/pages/Purchases"));
const Products = lazy(() => import("@/pages/Products"));
const ProductForm = lazy(() => import("@/pages/ProductForm"));
const Customers = lazy(() => import("@/pages/Customers"));
const PartyDetail = lazy(() => import("@/pages/PartyDetail"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Reports = lazy(() => import("@/pages/Reports"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const PrintSale = lazy(() => import("@/pages/print/PrintSale"));
const PrintReceipt = lazy(() => import("@/pages/print/PrintReceipt"));
const PrintLedger = lazy(() => import("@/pages/print/PrintLedger"));
const PrintTable = lazy(() => import("@/pages/print/PrintTable"));

function Splash() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Loader2 className="size-10 animate-spin text-primary" />
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "setup") return <LoginPage setup />;
  if (status === "login") return <LoginPage />;
  return <>{children}</>;
}

/** রিপোর্ট প্রিন্ট শুধু মালিক; বিক্রির তালিকা সবাই */
function OwnerOrSalesPrint() {
  const { isOwner } = useAuth();
  const kind = new URLSearchParams(window.location.search).get("kind");
  return isOwner || kind === "sales" ? <PrintTable /> : <Navigate to="/" replace />;
}

function OwnerOnly({ children }: { children: ReactNode }) {
  const { isOwner } = useAuth();
  return isOwner ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          <BrowserRouter>
            <Gate>
              <Suspense fallback={<Splash />}>
                <Routes>
                  <Route path="/print/sale/:id" element={<PrintSale />} />
                  <Route path="/print/receipt/:id" element={<PrintReceipt />} />
                  <Route path="/print/ledger/:type/:id" element={<PrintLedger />} />
                  <Route path="/print/table" element={<OwnerOrSalesPrint />} />
                  <Route element={<AppShell />}>
                    <Route index element={<Dashboard />} />
                    <Route path="sell" element={<Sell />} />
                    <Route path="sales" element={<Sales />} />
                    <Route path="sales/:id" element={<SaleDetail />} />
                    <Route path="purchase" element={<OwnerOnly><Purchase /></OwnerOnly>} />
                    <Route path="purchase/list" element={<OwnerOnly><Purchases /></OwnerOnly>} />
                    <Route path="products" element={<Products />} />
                    <Route path="products/new" element={<OwnerOnly><ProductForm /></OwnerOnly>} />
                    <Route path="products/:id" element={<OwnerOnly><ProductForm /></OwnerOnly>} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="customers/:id" element={<PartyDetail type="customer" />} />
                    <Route path="suppliers" element={<OwnerOnly><Suppliers /></OwnerOnly>} />
                    <Route path="suppliers/:id" element={<OwnerOnly><PartyDetail type="supplier" /></OwnerOnly>} />
                    <Route path="expenses" element={<Expenses />} />
                    <Route path="reports" element={<OwnerOnly><Reports /></OwnerOnly>} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </Gate>
          </BrowserRouter>
          <Toaster position="top-center" />
        </AuthProvider>
      </TooltipProvider>
    </I18nProvider>
  );
}
