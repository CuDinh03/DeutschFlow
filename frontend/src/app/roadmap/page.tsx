"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function RoadmapPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get("/roadmap/setup");
        if (cancelled) return;
        router.replace(res.data?.exists === false ? "/roadmap/setup" : "/roadmap/tree");
      } catch {
        if (!cancelled) router.replace("/roadmap/setup");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <div className="min-h-screen flex items-center justify-center text-slate-500">Đang tải lộ trình...</div>;
}
