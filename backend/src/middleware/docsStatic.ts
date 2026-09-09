import express, { type RequestHandler } from "express";
import fs from "fs";
import path from "path";

const PRESENTATION_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
].join("; ");

export function resolveDocsDir(): string {
  const candidates = [
    path.join(__dirname, "docs"),
    path.join(__dirname, "../docs"),
    path.join(process.cwd(), "src/docs"),
  ];
  return (
    candidates.find((dir) => fs.existsSync(path.join(dir, "presentation.html"))) ??
    path.join(process.cwd(), "src/docs")
  );
}

export function docsStatic(): RequestHandler[] {
  const dir = resolveDocsDir();
  return [
    (_req, res, next) => {
      res.setHeader("Content-Security-Policy", PRESENTATION_CSP);
      next();
    },
    express.static(dir, { index: false, fallthrough: true }),
  ];
}
