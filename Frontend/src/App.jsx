import React from "react";
import { AppRoutes } from "./routes/AppRoutes.jsx";
import { useSession } from "./hooks/useSession.js";
import { useToast } from "./hooks/useToast.js";

export default function App() {
  const { toast, notify } = useToast();
  const { user, saveSession, logout } = useSession(notify);

  return <AppRoutes user={user} saveSession={saveSession} logout={logout} toast={toast} notify={notify} />;
}
