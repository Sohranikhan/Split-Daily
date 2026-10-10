function toPublicUser(user) {
  return {
    id: user.id,
    publicId: user.publicId,
    name: user.name,
    email: user.email,
    avatarUrl: user.profileImageUrl,
    loginMethod: user.loginMethod,
    role: user.role,
    defaultCurrency: user.defaultCurrency,
    lastSignedIn: user.lastSignedIn.toISOString()
  };
}
export {
  toPublicUser
};
