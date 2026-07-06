<script lang="ts">
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { WebLinksAddon } from "@xterm/addon-web-links";
  import "@xterm/xterm/css/xterm.css";
  import { untrack } from "svelte";
  import { app, terminalBus } from "../state.svelte";

  let host: HTMLDivElement;
  let term: Terminal | null = null;
  let fitAddon: FitAddon | null = null;

  const darkTheme = {
    background: "#181818",
    foreground: "#cccccc",
    cursor: "#cccccc",
    selectionBackground: "#264f78",
    black: "#000000", red: "#cd3131", green: "#0dbc79", yellow: "#e5e510",
    blue: "#2472c8", magenta: "#bc3fbc", cyan: "#11a8cd", white: "#e5e5e5",
    brightBlack: "#666666", brightRed: "#f14c4c", brightGreen: "#23d18b",
    brightYellow: "#f5f543", brightBlue: "#3b8eea", brightMagenta: "#d670d6",
    brightCyan: "#29b8db", brightWhite: "#ffffff",
  };
  const lightTheme = {
    background: "#ffffff",
    foreground: "#3b3b3b",
    cursor: "#005fb8",
    selectionBackground: "#add6ff",
    black: "#000000", red: "#cd3131", green: "#107c10", yellow: "#949800",
    blue: "#0451a5", magenta: "#bc05bc", cyan: "#0598bc", white: "#555555",
    brightBlack: "#666666", brightRed: "#cd3131", brightGreen: "#14ce14",
    brightYellow: "#b5ba00", brightBlue: "#0451a5", brightMagenta: "#bc05bc",
    brightCyan: "#0598bc", brightWhite: "#a5a5a5",
  };

  // Local line editing while Python waits on input()
  let inputBuffer = "";

  const baseFontSize = matchMedia("(pointer: coarse)").matches ? 14 : 13;

  $effect(() => {
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace',
      fontSize: untrack(() => app.beamer) ? 18 : baseFontSize,
      // untrack: the theme-change effect below updates the live instance;
      // this creation effect must not re-run (it would wipe the scrollback).
      theme: untrack(() => app.theme) === "dark" ? darkTheme : lightTheme,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    fitAddon = fit;
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(host);
    fit.fit();
    term = terminal;

    terminal.onData((data) => {
      if (data === "\x03") {
        // Ctrl+C
        if (
          app.runnerStatus === "running" ||
          app.runnerStatus === "awaiting-input"
        ) {
          terminal.write("^C\r\n");
          inputBuffer = "";
          app.stop();
        }
        return;
      }
      if (app.runnerStatus !== "awaiting-input") return;
      for (const ch of data) {
        if (ch === "\r" || ch === "\n") {
          terminal.write("\r\n");
          const line = inputBuffer;
          inputBuffer = "";
          app.runner.provideStdin(line);
          return;
        } else if (ch === "\x7f" || ch === "\b") {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            terminal.write("\b \b");
          }
        } else if (ch >= " " || ch === "\t") {
          inputBuffer += ch;
          terminal.write(ch);
        }
      }
    });

    terminalBus.write = (data) => terminal.write(data);
    terminalBus.focus = () => terminal.focus();

    terminal.writeln("\x1b[2mPyIDE Terminal — Python startet …\x1b[0m");

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // host not laid out yet
      }
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      terminalBus.write = () => {};
      terminalBus.focus = () => {};
      terminal.dispose();
      term = null;
      fitAddon = null;
    };
  });

  $effect(() => {
    if (term) {
      term.options.theme = app.theme === "dark" ? darkTheme : lightTheme;
    }
  });

  // Beamer mode: larger terminal font
  $effect(() => {
    const size = app.beamer ? 18 : baseFontSize;
    if (term) {
      term.options.fontSize = size;
      try {
        fitAddon?.fit();
      } catch {
        // host hidden
      }
    }
  });
</script>

<div class="terminal-host" bind:this={host}></div>

<style>
  .terminal-host {
    height: 100%;
    width: 100%;
    background: var(--terminal-bg);
    padding: 4px 0 0 8px;
  }
  .terminal-host :global(.xterm) {
    height: 100%;
  }
</style>
