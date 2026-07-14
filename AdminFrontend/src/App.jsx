import React from "react";
import { AdminRoutes } from "./routes/AdminRoutes.jsx";
import { AdminAuthProvider } from "./context/AdminAuthContext.jsx";
import { useToast } from "./hooks/useToast.js";

export default function App() {
  const { toast, notify } = useToast();
  return (
    <AdminAuthProvider>
      <AdminRoutes toast={toast} notify={notify} />
    </AdminAuthProvider>
  );
}
