import AzureADProvider from 'next-auth/providers/azure-ad';

function getAllowedDomains() {
  return (process.env.AUTH_ALLOWED_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function getEmail(profile, user, token) {
  return (
    user?.email ||
    profile?.email ||
    profile?.preferred_username ||
    profile?.upn ||
    token?.email ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
}

export const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/',
  },
  callbacks: {
    async signIn({ profile, user }) {
      const allowedDomains = getAllowedDomains();
      const email = getEmail(profile, user);

      console.log('[AUTH signIn] email:', email);
      console.log('[AUTH signIn] profile:', profile);

      if (allowedDomains.length > 0) {
        const domain = email.includes('@') ? email.split('@')[1] : '';
        if (!allowedDomains.includes(domain)) {
          return false;
        }
      }

      return true;
    },

    async jwt({ token, account, profile, user }) {
      if (account) {
        token.provider = account.provider;
      }

      const email = getEmail(profile, user, token);
      if (email) {
        token.email = email;
      }

      if (profile) {
        token.tid = profile.tid || null;
        token.preferred_username = profile.preferred_username || null;
        token.upn = profile.upn || null;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = (
          token.email ||
          session.user.email ||
          ''
        )
          .toString()
          .trim()
          .toLowerCase();

        session.user.name = session.user.name || '';
      }

      session.provider = token.provider || null;
      session.tid = token.tid || null;
      session.preferred_username = token.preferred_username || null;
      session.upn = token.upn || null;

      return session;
    },
  },
};