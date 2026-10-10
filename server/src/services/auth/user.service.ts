import { and, eq } from "drizzle-orm";
import { getDb } from "../../database/client";
import { accounts, users, type User } from "../../models";
import { ENV } from "../../config/env";
import type { GoogleProfile } from "./google.service";
import { acceptEmailInvites } from "../group.service";

/**
 * Finds or creates the user for a Google identity.
 * 1. Existing Google account link (by Google `sub`) wins.
 * 2. Otherwise a user with the same *verified* email is linked.
 * 3. Otherwise a new user is created.
 */
export async function upsertGoogleUser(profile: GoogleProfile): Promise<User> {
  const db = getDb();
  const now = new Date();
  const isAdmin = Boolean(profile.email && profile.emailVerified && ENV.adminEmails.includes(profile.email));

  return db.transaction(async (tx) => {
    const linked = await tx
      .select({ user: users })
      .from(accounts)
      .innerJoin(users, eq(users.id, accounts.userId))
      .where(and(eq(accounts.provider, "google"), eq(accounts.providerAccountId, profile.sub)))
      .limit(1);

    let user = linked[0]?.user;

    if (!user && profile.email && profile.emailVerified) {
      const byEmail = await tx.select().from(users).where(eq(users.email, profile.email)).limit(1);
      user = byEmail[0];
    }

    if (!user) {
      const created = await tx
        .insert(users)
        .values({
          name: profile.name,
          email: profile.emailVerified ? profile.email : null,
          emailVerified: profile.emailVerified,
          profileImageUrl: profile.picture,
          loginMethod: "google",
          role: isAdmin ? "admin" : "user",
          lastSignedIn: now,
        })
        .returning();
      user = created[0]!;
    } else {
      const updated = await tx
        .update(users)
        .set({
          name: user.name ?? profile.name,
          profileImageUrl: profile.picture ?? user.profileImageUrl,
          emailVerified: user.emailVerified || profile.emailVerified,
          loginMethod: "google",
          lastSignedIn: now,
          deletedAt: null,
          ...(isAdmin ? { role: "admin" as const } : {}),
        })
        .where(eq(users.id, user.id))
        .returning();
      user = updated[0]!;
    }

    await tx
      .insert(accounts)
      .values({ userId: user.id, provider: "google", providerAccountId: profile.sub, email: profile.email })
      .onConflictDoUpdate({
        target: [accounts.provider, accounts.providerAccountId],
        set: { email: profile.email, updatedAt: now },
      });

    // Join any groups this email was invited to before the account existed.
    await acceptEmailInvites(tx, user);

    return user;
  });
}
