export function toSpeechText(text) {
  return String(text ?? "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\w-]*\s*([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, " $1 ")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]{0,3}(?:[-+*][ \t]+)?(?:\d+[.)][ \t]+)?/gm, "")
    .replace(/[*_~#|]/g, " ")
    .replace(/^[ \t]+/gm, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
