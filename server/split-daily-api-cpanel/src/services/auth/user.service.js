import { and, eq } from "drizzle-orm";
import { getDb } from "../../database/client.js";
import { accounts, users } from "../../models/index.js";
import { ENV } from "../../config/env.js";
import { acceptEmailInvites } from "../group.service.js";
async function upsertGoogleUser(profile) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const isAdmin = Boolean(profile.email && profile.emailVerified && ENV.adminEmails.includes(profile.email));
  return db.transaction(async (tx) => {
    const linked = await tx.select({ user: users }).from(accounts).innerJoin(users, eq(users.id, accounts.userId)).where(and(eq(accounts.provider, "google"), eq(accounts.providerAccountId, profile.sub))).limit(1);
    let user = linked[0]?.user;
    if (!user && profile.email && profile.emailVerified) {
      const byEmail = await tx.select().from(users).where(eq(users.email, profile.email)).limit(1);
      user = byEmail[0];
    }
    if (!user) {
      const created = await tx.insert(users).values({
        name: profile.name,
        email: profile.emailVerified ? profile.email : null,
        emailVerified: profile.emailVerified,
        profileImageUrl: profile.picture,
        loginMethod: "google",
        role: isAdmin ? "admin" : "user",
        lastSignedIn: now
      }).returning();
      user = created[0];
    } else {
      const updated = await tx.update(users).set({
        name: user.name ?? profile.name,
        profileImageUrl: profile.picture ?? user.profileImageUrl,
        emailVerified: user.emailVerified || profile.emailVerified,
        loginMethod: "google",
        lastSignedIn: now,
        deletedAt: null,
        ...isAdmin ? { role: "admin" } : {}
      }).where(eq(users.id, user.id)).returning();
      user = updated[0];
    }
    await tx.insert(accounts).values({ userId: user.id, provider: "google", providerAccountId: profile.sub, email: profile.email }).onConflictDoUpdate({
      target: [accounts.provider, accounts.providerAccountId],
      set: { email: profile.email, updatedAt: now }
    });
    await acceptEmailInvites(tx, user);
    return user;
  });
}
export {
  upsertGoogleUser
};
