import { RouterProvider } from "react-router";
import { router } from "./routes";
import { migrateLegacyTokenKeys } from "./lib/auth";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    migrateLegacyTokenKeys();
  }, []);
  return <RouterProvider router={router} />;
}
