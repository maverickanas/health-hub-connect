import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativeShell } from "./lib/native-shell";

// No-op on web, wires status bar / back button / splash on native.
initNativeShell();

createRoot(document.getElementById("root")!).render(<App />);
