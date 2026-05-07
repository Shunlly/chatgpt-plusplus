export const CODEX_WINDOW_SERVICES_KEY = "__codexpp_window_services__";

export interface CodexWindowServicesPatch {
  source: string;
  changed: boolean;
  strategy: "already-patched" | "repair-missing-separator" | "service-factory-fingerprint";
  serviceVar?: string;
}

export interface CodexWindowServicesSourceDiagnostics {
  hasMarker: boolean;
  buildFlavorProperties: number;
  objectCalls: number;
  matchedFingerprints: string[];
  snippet: string | null;
}

interface ServiceFactoryAssignment {
  serviceVar: string;
  callEnd: number;
}

const IDENT_RE = /^[$A-Za-z_][$A-Za-z0-9_]*$/;
const OBJECT_CALL_RE = /([$A-Za-z_][$A-Za-z0-9_]*)\s*\(\s*\{/g;
const WINDOW_SERVICE_FINGERPRINTS = [
  "allowDevtools:",
  "allowDebugMenu:",
  "allowInspectElement:",
  "globalState:",
  "getGlobalStateForHost:",
  "desktopRoot:",
  "preloadPath:",
  "repoRoot:",
  "canHideLastLocalWindowToTray:",
  "disposables:",
];

export function patchCodexWindowServicesSource(
  source: string,
  marker = CODEX_WINDOW_SERVICES_KEY,
): CodexWindowServicesPatch | null {
  const repaired = repairMalformedMarkerAssignment(source, marker);
  if (repaired) return repaired;

  if (source.includes(markerAssignment(marker))) {
    return { source, changed: false, strategy: "already-patched" };
  }

  const assignment = findWindowServicesFactoryAssignment(source);
  if (!assignment) return null;

  const statementEnd = findStatementEnd(source, assignment.callEnd + 1);
  if (statementEnd < 0) {
    throw new Error("Codex window services declaration end could not be identified");
  }

  return {
    source:
      source.slice(0, statementEnd + 1) +
      `globalThis.${marker}=${assignment.serviceVar};` +
      source.slice(statementEnd + 1),
    changed: true,
    strategy: "service-factory-fingerprint",
    serviceVar: assignment.serviceVar,
  };
}

export function describeCodexWindowServicesSource(
  source: string,
  marker = CODEX_WINDOW_SERVICES_KEY,
): CodexWindowServicesSourceDiagnostics {
  return {
    hasMarker: source.includes(markerAssignment(marker)),
    buildFlavorProperties: countObjectProperty(source, "buildFlavor"),
    objectCalls: countObjectCalls(source),
    matchedFingerprints: matchedWindowServicesFingerprints(source),
    snippet: diagnosticSnippet(source),
  };
}

function repairMalformedMarkerAssignment(
  source: string,
  marker: string,
): CodexWindowServicesPatch | null {
  const assignment = findWindowServicesFactoryAssignment(source);
  if (!assignment) return null;

  const assignmentText = markerAssignment(marker);
  const markerIndex = source.indexOf(assignmentText);
  if (markerIndex < 0) return null;

  const valueIndex = markerIndex + assignmentText.length;
  if (!source.startsWith(assignment.serviceVar, valueIndex)) return null;

  const nextIndex = valueIndex + assignment.serviceVar.length;
  if (source[nextIndex] === ";") return null;
  if (!/[$A-Za-z_]/.test(source[nextIndex] ?? "")) return null;

  return {
    source: source.slice(0, nextIndex) + ";" + source.slice(nextIndex),
    changed: true,
    strategy: "repair-missing-separator",
    serviceVar: assignment.serviceVar,
  };
}

function findWindowServicesFactoryAssignment(source: string): ServiceFactoryAssignment | null {
  OBJECT_CALL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OBJECT_CALL_RE.exec(source)) !== null) {
    const functionName = match[1] ?? "";
    const parenStart = match.index + match[0].indexOf("(");
    const serviceVar = findAssignedIdentifierBefore(source, match.index);
    if (!serviceVar) continue;

    const callEnd = findMatchingBracket(source, parenStart, "(", ")");
    if (callEnd < 0) continue;

    const callSource = source.slice(parenStart, callEnd + 1);
    if (!looksLikeWindowServicesFactory(callSource)) continue;

    return { serviceVar, callEnd };
  }

  return null;
}

function findAssignedIdentifierBefore(source: string, index: number): string | null {
  const eqIndex = skipWhitespaceBackward(source, index - 1);
  if (source[eqIndex] !== "=") return null;

  let end = skipWhitespaceBackward(source, eqIndex - 1) + 1;
  let start = end;
  while (start > 0 && /[$A-Za-z0-9_]/.test(source[start - 1] ?? "")) start -= 1;

  const identifier = source.slice(start, end);
  return IDENT_RE.test(identifier) ? identifier : null;
}

function looksLikeWindowServicesFactory(callSource: string): boolean {
  return hasObjectProperty(callSource, "buildFlavor")
    && matchedWindowServicesFingerprints(callSource).length >= 5;
}

function findStatementEnd(source: string, startIndex: number): number {
  let parens = 0;
  let braces = 0;
  let brackets = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i] ?? "";
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") parens += 1;
    else if (ch === ")") parens -= 1;
    else if (ch === "{") braces += 1;
    else if (ch === "}") braces -= 1;
    else if (ch === "[") brackets += 1;
    else if (ch === "]") brackets -= 1;
    else if (ch === ";" && parens === 0 && braces === 0 && brackets === 0) {
      return i;
    }
  }

  return -1;
}

function findMatchingBracket(
  source: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): number {
  if (source[openIndex] !== openChar) return -1;

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i] ?? "";
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function skipWhitespaceBackward(source: string, index: number): number {
  let i = index;
  while (i >= 0 && /\s/.test(source[i] ?? "")) i -= 1;
  return i;
}

function markerAssignment(marker: string): string {
  return `globalThis.${marker}=`;
}

function matchedWindowServicesFingerprints(source: string): string[] {
  const out: string[] = [];
  for (const fingerprint of WINDOW_SERVICE_FINGERPRINTS) {
    const property = fingerprint.slice(0, -1);
    if (hasObjectProperty(source, property)) out.push(property);
  }
  return out;
}

function hasObjectProperty(source: string, property: string): boolean {
  return objectPropertyRegExp(property).test(source);
}

function countObjectProperty(source: string, property: string): number {
  const matches = source.match(objectPropertyRegExp(property, "g"));
  return matches ? matches.length : 0;
}

function countObjectCalls(source: string): number {
  const matches = source.match(/[$A-Za-z_][$A-Za-z0-9_]*\s*\(\s*\{/g);
  return matches ? matches.length : 0;
}

function objectPropertyRegExp(property: string, flags = ""): RegExp {
  return new RegExp(`(?:^|[,{])\\s*["']?${escapeRegExp(property)}["']?\\s*:`, flags);
}

function diagnosticSnippet(source: string): string | null {
  const anchors = [
    source.indexOf("buildFlavor"),
    ...WINDOW_SERVICE_FINGERPRINTS.map((fingerprint) => source.indexOf(fingerprint.slice(0, -1))),
  ].filter((index) => index >= 0);
  if (anchors.length === 0) return null;

  const anchor = Math.min(...anchors);
  const start = Math.max(0, anchor - 90);
  const end = Math.min(source.length, anchor + 220);
  return source.slice(start, end).replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
