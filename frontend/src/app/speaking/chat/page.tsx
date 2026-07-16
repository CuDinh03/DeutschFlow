"use client";

import { SpeakingChatExperience } from "@/components/features/ai-speaking/SpeakingChatExperience";

// Legacy shell for the live conversation engine. The engine itself moved to
// <SpeakingChatExperience> so the /v2 route (/v2/student/speaking/live) mounts the SAME
// code instead of deep-linking back here. Behaviour is unchanged: only the routes are
// injected. This page dies with the rest of v1.
export default function AIChatInterface() {
  return (
    <SpeakingChatExperience
      layout="page"
      routes={{
        setup: "/speaking",
        review: "/student/review",
        history: "/student/speaking-history",
        home: "/",
        pricing: "/student/pricing",
      }}
    />
  );
}
