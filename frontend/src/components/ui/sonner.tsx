"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Light theme default — app shell does not mount `ThemeProvider`; avoids useTheme runtime errors. */
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="light"
    richColors
    closeButton
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          "backdrop-blur-md bg-white/95 border border-[#E2E8F0] shadow-lg shadow-[#121212]/10 rounded-xl",
      },
    }}
    style={
      {
        "--normal-bg": "rgba(255,255,255,0.96)",
        "--normal-text": "#0f172a",
        "--normal-border": "#E2E8F0",
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
