// A안: events share one calm blue style instead of a colour per title.
const STYLE = { bg: "#EEF2FC", fg: "#2F5BB8", bar: "#3A6FD8" };

export function eventColor(title: string) {
  void title; // kept so callers stay the same; every event looks alike in this theme
  return STYLE;
}
