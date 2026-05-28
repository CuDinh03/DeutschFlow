"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getMyLearningProfile } from "@/lib/profileApi";
import { usePageTimeTracker } from "@/hooks/usePageTimeTracker";

export default function StudentRoadmapRedirectPage() {
  usePageTimeTracker('roadmap');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const resolveRoadmap = async () => {
      try {
        await getMyLearningProfile();
        if (!cancelled) router.replace("/roadmap/tree");
      } catch {
        if (!cancelled) router.replace("/roadmap/setup");
      }
    };

    resolveRoadmap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F4F9]">
      <Loader2 size={28} className="animate-spin text-[#121212]" />
    </div>
  );
}
