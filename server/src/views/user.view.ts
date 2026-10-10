import type { User } from "../models";

/** The user as the app sees it (never exposes internal fields like sessions or provider ids). */
export type PublicUser = {
  id: number;
  publicId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  defaultCurrency: string;
  lastSignedIn: string;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    publicId: user.publicId,
    name: user.name,
    email: user.email,
    avatarUrl: user.profileImageUrl,
    loginMethod: user.loginMethod,
    role: user.role,
    defaultCurrency: user.defaultCurrency,
    lastSignedIn: user.lastSignedIn.toISOString(),
  };
}
