/**
 * CodeMirror themes: VS Code style editor chrome combined with GitHub's
 * (Primer) syntax highlighting palette, in light and dark variants.
 */
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

function chrome(dark: boolean): Extension {
  return EditorView.theme(
    {
      "&": {
        color: "var(--editor-fg)",
        backgroundColor: "var(--editor-bg)",
        height: "100%",
        fontSize: "13.5px",
      },
      ".cm-content": {
        caretColor: "var(--editor-fg)",
        fontFamily: "var(--mono-font)",
        paddingBottom: "40vh",
      },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--editor-fg)" },
      "&.cm-focused": { outline: "none" },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, ::selection":
        { backgroundColor: dark ? "#264f78" : "#add6ff" },
      ".cm-selectionBackground": {
        backgroundColor: dark ? "#264f7855" : "#add6ff77",
      },
      ".cm-activeLine": {
        backgroundColor: dark ? "#ffffff08" : "#0000000a",
      },
      ".cm-gutters": {
        backgroundColor: "var(--editor-bg)",
        color: dark ? "#6e7681" : "#8c959f",
        border: "none",
        fontFamily: "var(--mono-font)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "var(--editor-fg)",
      },
      ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 20px" },
      ".cm-matchingBracket": {
        backgroundColor: dark ? "#3fb95040" : "#34d05840",
        outline: `1px solid ${dark ? "#3fb95088" : "#34d05888"}`,
      },
      ".cm-tooltip": {
        backgroundColor: "var(--panel-bg)",
        color: "var(--fg)",
        border: "1px solid var(--border)",
      },
      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: dark ? "#04395e" : "#0060c0",
        color: "#ffffff",
      },
      ".cm-panels": {
        backgroundColor: "var(--panel-bg)",
        color: "var(--fg)",
        border: "1px solid var(--border)",
      },
      ".cm-searchMatch": {
        backgroundColor: dark ? "#f2cc6044" : "#fddf6866",
        outline: `1px solid ${dark ? "#f2cc60" : "#d4a72c"}`,
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: dark ? "#9e6a03aa" : "#ff9632aa",
      },
    },
    { dark },
  );
}

// GitHub Light (Primer) token colors
const githubLightHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword], color: "#cf222e" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#0a3069" },
  { tag: [t.comment, t.blockComment, t.lineComment], color: "#59636e", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.name)], color: "#0550ae" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#8250df" },
  { tag: [t.className, t.namespace], color: "#953800" },
  { tag: [t.definition(t.variableName), t.propertyName], color: "#0550ae" },
  { tag: [t.variableName, t.name], color: "#1f2328" },
  { tag: [t.self, t.special(t.variableName)], color: "#cf222e" },
  { tag: [t.operator, t.punctuation], color: "#1f2328" },
  { tag: t.invalid, color: "#82071e", backgroundColor: "#ffebe9" },
  { tag: [t.meta, t.annotation], color: "#116329" },
  { tag: t.heading, color: "#0550ae", fontWeight: "bold" },
  { tag: t.link, color: "#0a3069", textDecoration: "underline" },
]);

// GitHub Dark (Primer) token colors
const githubDarkHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword], color: "#ff7b72" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#a5d6ff" },
  { tag: [t.comment, t.blockComment, t.lineComment], color: "#8b949e", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.name)], color: "#79c0ff" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#d2a8ff" },
  { tag: [t.className, t.namespace], color: "#ffa657" },
  { tag: [t.definition(t.variableName), t.propertyName], color: "#79c0ff" },
  { tag: [t.variableName, t.name], color: "#e6edf3" },
  { tag: [t.self, t.special(t.variableName)], color: "#ff7b72" },
  { tag: [t.operator, t.punctuation], color: "#e6edf3" },
  { tag: t.invalid, color: "#ffa198", backgroundColor: "#490202" },
  { tag: [t.meta, t.annotation], color: "#7ee787" },
  { tag: t.heading, color: "#79c0ff", fontWeight: "bold" },
  { tag: t.link, color: "#a5d6ff", textDecoration: "underline" },
]);

export const githubLight: Extension = [
  chrome(false),
  syntaxHighlighting(githubLightHighlight),
];
export const githubDark: Extension = [
  chrome(true),
  syntaxHighlighting(githubDarkHighlight),
];
