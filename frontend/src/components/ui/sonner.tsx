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
        // Chỉ skin toast mặc định (data-styled=true). toast.custom() — GaNotificationToast —
        // tự mang thẻ Galerie riêng, wrapper phải trong suốt để không lộ viền/nền đúp.
        toast:
          "data-[styled=true]:backdrop-blur-md data-[styled=true]:bg-white/95 data-[styled=true]:border data-[styled=true]:border-[#E2E8F0] data-[styled=true]:shadow-lg data-[styled=true]:shadow-[#121212]/10 data-[styled=true]:rounded-xl",
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
