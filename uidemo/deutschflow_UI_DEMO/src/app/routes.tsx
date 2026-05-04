import { createBrowserRouter } from "react-router";
import Dashboard from "./pages/Dashboard";
import Lesson from "./pages/Lesson";
import Admin from "./pages/Admin";
import GameScreen from "./pages/GameScreen";
import Roadmap from "./pages/Roadmap";
import Vocabulary from "./pages/Vocabulary";
import Speaking from "./pages/Speaking";
import Flashcards from "./pages/Flashcards";
import SwipeCards from "./pages/SwipeCards";
import TutorProfile from "./pages/TutorProfile";
import CompanionSelect from "./pages/CompanionSelect";
import AIChat from "./pages/AIChat";
import WebDashboard from "./pages/WebDashboard";
import ErrorLibrary from "./pages/ErrorLibrary";

export const router = createBrowserRouter([
  { path: "/",           Component: Dashboard },
  { path: "/lesson",     Component: Lesson },
  { path: "/admin",      Component: Admin },
  { path: "/game",       Component: GameScreen },
  { path: "/roadmap",    Component: Roadmap },
  { path: "/vocabulary", Component: Vocabulary },
  { path: "/speaking",   Component: Speaking },
  { path: "/flashcards", Component: Flashcards },
  { path: "/swipe",      Component: SwipeCards },
  { path: "/tutor",      Component: TutorProfile },
  { path: "/companion",  Component: CompanionSelect },
  { path: "/chat",       Component: AIChat },
  { path: "/web",        Component: WebDashboard },
  { path: "/errors",     Component: ErrorLibrary },
]);