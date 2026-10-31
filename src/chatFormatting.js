function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

export function formatChatText(value) {
  return String(value ?? "")
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line)
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*[-+*]\s+/, "• ")
        .replace(/^\s*(\d+)[.)]\s+/, "$1. ");
      return formatInlineMarkdown(escaped);
    })
    .join("<br>");
}
