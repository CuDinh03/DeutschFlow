"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route: token usage UI was removed — redirect to subscription tier screen. */
export default function LegacyGroqUsageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/my-plan");
  }, [router]);
  return null;
}
