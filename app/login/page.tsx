'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', {
      username, password, redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      router.push('/');
    } else {
      setError('Identifiant ou mot de passe incorrect.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a2e0a 0%, #2D5016 50%, #3d1a00 100%)',
      fontFamily: 'var(--font-dm), sans-serif',
    }}>
      <div style={{
        background: '#FAFAF7', borderRadius: 16, padding: '2.5rem 2rem',
        width: 360, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4A7A1E, #B8860B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', fontSize: 22,
          }}>🌳</div>
          <h1 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
            Famille GHUSSEIN
          </h1>
          <p style={{ fontSize: 11, color: '#6B7280', letterSpacing: 2, textTransform: 'uppercase' }}>
            Accès Administrateur · SAYELE
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
              Identifiant
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin.ghussein"
              required
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB',
                borderRadius: 8, fontSize: 13, background: '#fff', color: '#1A1A1A',
                fontFamily: 'var(--font-dm), sans-serif', outline: 'none',
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB',
                borderRadius: 8, fontSize: 13, background: '#fff', color: '#1A1A1A',
                fontFamily: 'var(--font-dm), sans-serif', outline: 'none',
              }}
            />
          </div>
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: '8px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 14,
            }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px', borderRadius: 8,
              background: loading ? '#9CA3AF' : '#4A7A1E',
              color: '#fff', border: 'none', fontSize: 13, fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-dm), sans-serif',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#9CA3AF', marginTop: '1.5rem' }}>
          SAYELE GROUP · Arbre Dynastique Privé
        </p>
      </div>
    </div>
  );
}
