import type { Response } from "express";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Minimal page for errors where we have nowhere safe to redirect to. */
export function sendErrorPage(res: Response, status: number, title: string, detail: string) {
  res
    .status(status)
    .type("html")
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;background:#F7F8F5;color:#17231B;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}` +
        `main{max-width:420px;background:#fff;border:1px solid #E1E7DF;border-radius:24px;padding:28px}h1{font-size:22px;margin:0 0 8px}p{color:#56635A;line-height:1.5;margin:0}</style>` +
        `</head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></main></body></html>`,
    );
}
