"use client";

import { SessionProvider } from "next-auth/react";
import { ScanProvider } from "@/contexts/ScanContext";
import FirstAirportModal from "@/components/onboarding/FirstAirportModal";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ScanProvider>
        {children}
        <FirstAirportModal />
      </ScanProvider>
    </SessionProvider>
  );
}
