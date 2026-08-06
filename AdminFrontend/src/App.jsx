import React from "react";
import { AdminRoutes } from "./routes/AdminRoutes.jsx";
import { AdminAuthProvider } from "./context/AdminAuthContext.jsx";
import { NetworkStatusBanner, PwaUpdatePrompt } from "./components/common/PwaStatus.jsx";
import { useToast } from "./hooks/useToast.js";

export default function App() {
  const { toast, notify } = useToast();
  return (
    <>
      <NetworkStatusBanner />
      <PwaUpdatePrompt />
      <AdminAuthProvider>
        <AdminRoutes toast={toast} notify={notify} />
      </AdminAuthProvider>
    </>
  );
}
