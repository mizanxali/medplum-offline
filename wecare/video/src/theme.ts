import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import type { Risk } from "../../src/domain/news2";

// Tokens copied from the app's src/ui/kit.tsx. Never set fontWeight: pick the face.
export const C = {
  bg: "#E1EFF4",
  surface: "#F9FCFD",
  sunken: "#EFF6F8",
  line: "#C8DDE4",
  ink: "#1D2733",
  muted: "#3F5563",
  faint: "#5F7380",
  accent: "#6E1F30",
  accentPressed: "#56172A",
  accentSoft: "#F3E6E9",
  success: "#1D6A42",
  successSoft: "#E1F0E7",
  error: "#D42620",
  errorSoft: "#FEF0EE",
  amber: "#9C6512",
  amberSoft: "#FBF1DD",
  orange: "#C2541A",
  orangeSoft: "#FCEADD",
};

export const F = {
  title: "Neuton-Bold",
  heading: "Neuton-Regular",
  body: "HostGroteskLight-Regular",
  medium: "HostGroteskLight-Medium",
  strong: "HostGroteskLight-SemiBold",
};

for (const family of Object.values(F)) {
  loadFont({ family, url: staticFile(`fonts/${family}.ttf`) });
}

// The app's StyleSheet (st.*). RN line heights are px; CSS numbers would be multipliers.
export const T = {
  screenTitle: { fontFamily: F.title, fontSize: 32, color: C.ink, letterSpacing: -0.2 },
  sectionTitle: { fontFamily: F.heading, fontSize: 23, color: C.ink },
  count: { fontFamily: F.medium, fontSize: 13, color: C.muted, marginLeft: 8, marginTop: 2 },
  title: { fontFamily: F.heading, fontSize: 21, color: C.ink, lineHeight: "26px" },
  body: { fontFamily: F.body, fontSize: 15.5, lineHeight: "22px", color: C.ink },
  small: { fontFamily: F.body, fontSize: 13.5, lineHeight: "19px", color: C.muted },
  label: { fontFamily: F.medium, fontSize: 12.5, color: C.muted },
  mono: { fontFamily: "Menlo, monospace", fontSize: 12, color: C.muted },
  buttonText: { fontFamily: F.strong, fontSize: 16 },
  pillText: { fontFamily: F.medium, fontSize: 12.5 },
};

export const RISK: Record<Risk, { fg: string; bg: string; label: string }> = {
  low: { fg: C.success, bg: C.successSoft, label: "Low" },
  "low-medium": { fg: C.amber, bg: C.amberSoft, label: "Low-medium" },
  medium: { fg: C.orange, bg: C.orangeSoft, label: "Medium" },
  high: { fg: C.error, bg: C.errorSoft, label: "High" },
};
