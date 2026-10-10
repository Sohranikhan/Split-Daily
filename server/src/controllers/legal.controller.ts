import type { Request, Response } from "express";
import { ENV } from "../config/env";
import { renderDeleteAccountPage, renderPrivacyPolicy } from "../views/legal.view";

/** Public pages linked from Google Play and the app's Settings. */
export function privacyPolicy(_req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=3600").type("html").send(renderPrivacyPolicy(ENV.supportEmail));
}

export function deleteAccount(_req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=3600").type("html").send(renderDeleteAccountPage(ENV.supportEmail));
}
