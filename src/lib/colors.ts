// Soft paper-planner colours for events; the same title always gets the same colour.
const PALETTE = [
  { bg: "#FBEEDD", fg: "#A8692A", bar: "#E3A35B" },
  { bg: "#E8ECF5", fg: "#4A5C88", bar: "#7C8DB5" },
  { bg: "#E3F0E8", fg: "#3F7A5C", bar: "#6FA58A" },
  { bg: "#F0E9F6", fg: "#76599A", bar: "#A88BC4" },
  { bg: "#FBE8E3", fg: "#B4533E", bar: "#E08A73" },
  { bg: "#E4EEF4", fg: "#3E6E8C", bar: "#6E9BB8" },
  { bg: "#F6E4EC", fg: "#A14A6E", bar: "#D184A6" },
  { bg: "#F1EEDC", fg: "#7D6E2B", bar: "#C2AF5C" },
];

export function eventColor(title: string) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
