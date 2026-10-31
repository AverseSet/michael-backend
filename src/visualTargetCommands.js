const MAX_TARGET_LENGTH = 40;

function normalizeTarget(value) {
  const target = value
    .replace(/\b(?:please|for me)\b/gi, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:area|location|place)$/i, "")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!target || target.length > MAX_TARGET_LENGTH) return null;
  return target;
}

export function parseVisualTargetCommand(value) {
  if (typeof value !== "string") return null;
  const command = value
    .trim()
    .replace(/^(?:hey|yo)\s+michael[\s,.:;-]*/i, "")
    .trim();
  if (!command) return null;

  if (/^(?:clear|hide|remove|cancel)\s+(?:the\s+)?(?:marker|highlight|target)(?:\s+please)?[.!?]*$/i.test(command)) {
    return { type: "clear" };
  }

  const hereAs = /^(?:please\s+)?(?:mark|highlight|label)\s+here\s+(?:as|with the name|to show)\s+(?:the\s+)?(.+?)[.!?]*$/i.exec(command);
  if (hereAs) {
    const target = normalizeTarget(hereAs[1]);
    return target ? { type: "target", target } : null;
  }

  const hereIdentified = /^(?:please\s+)?(?:mark|highlight)\s+here\s*[,;:]?\s*(?:this is|it is|it's|called|as)\s+(?:the\s+)?(.+?)[.!?]*$/i.exec(command);
  if (hereIdentified) {
    const target = normalizeTarget(hereIdentified[1]);
    return target ? { type: "target", target } : null;
  }

  if (/^(?:please\s+)?(?:mark|pin)\s+here[.!?]*$/i.test(command)) {
    return { type: "pin", target: "Marked point" };
  }

  const locationQuestion = /^(?:where(?:\s+is|'s)|where can i find)\s+(?:the\s+)?(.+?)[.!?]*$/i.exec(command);
  if (locationQuestion) {
    const target = normalizeTarget(locationQuestion[1]);
    return target ? { type: "target", target } : null;
  }

  const directive = /^(?:please\s+)?(?:highlight|mark|label|find|locate|show me|point(?: me)? to|take me to|navigate to)\s+(?:the\s+)?(.+?)[.!?]*$/i.exec(command);
  if (directive) {
    const target = normalizeTarget(directive[1]);
    if (!target || /^(?:here|this|that|it)$/i.test(target)) return null;
    return { type: "target", target };
  }

  const identification = /^(?:please\s+)?(?:this is|we are at|we're at|i am at|i'm at)\s+(?:the\s+)?(.+?)[.!?]*$/i.exec(command);
  if (identification) {
    const target = normalizeTarget(identification[1]);
    return target ? { type: "target", target } : null;
  }

  return null;
}
