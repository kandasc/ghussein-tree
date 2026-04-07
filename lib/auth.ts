import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Admin credentials - hashed password for "ghussein2025"
const ADMIN_HASH = bcrypt.hashSync('ghussein2025', 10);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin',
      credentials: {
        username: { label: 'Identifiant', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        if (
          credentials.username === 'admin.ghussein' &&
          bcrypt.compareSync(credentials.password, ADMIN_HASH)
        ) {
          return { id: '1', name: 'Admin GHUSSEIN', email: 'admin@ghussein.family', role: 'admin' };
        }
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'ghussein-family-secret-2025-sayele',
};

export default NextAuth(authOptions);
