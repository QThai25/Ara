import React from "react";
import { Footer } from "../components/customer/Footer.jsx";
import { Header } from "../components/customer/Header.jsx";
import { FloatingContact } from "../components/customer/FloatingContact.jsx";
import { AriMascotProvider, useAriMascot } from "../context/AriMascotContext.jsx";

export function CustomerLayout({ user, logout, toast, children }) {
  return (
    <AriMascotProvider>
      <CustomerLayoutContent user={user} logout={logout} toast={toast}>
        {children}
      </CustomerLayoutContent>
    </AriMascotProvider>
  );
}

function CustomerLayoutContent({ user, logout, toast, children }) {
  const { interaction, message } = useAriMascot();

  return (
    <div className="app customer-app">
      <Header user={user} logout={logout} />
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      <main>{children}</main>
      <FloatingContact interaction={interaction} message={message} />
      <Footer />
    </div>
  );
}
