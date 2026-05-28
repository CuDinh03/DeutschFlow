import { Metadata } from "next";
import { Suspense } from "react";
import { CompanionSelect } from "@/components/features/ai-speaking/CompanionSelect";

export const metadata: Metadata = {
  title: "AI Speaking Tutor | DeutschFlow",
  description: "Luyện nói tiếng Đức với AI Tutor của DeutschFlow.",
};

export default function SpeakingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Suspense>
        <CompanionSelect />
      </Suspense>
    </main>
  );
}
