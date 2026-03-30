'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { QuarterlyMemory } from '@/components/home/QuarterlyMemory'
import { authClient } from '@/lib/auth-client'

export default function HomePage() {
  const router = useRouter()
  const [session, setSession] = useState<{ name: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    authClient.getSession().then((res) => {
      if (res?.data?.user) setSession({ name: res.data.user.name || res.data.user.email })
    })
  }, [])

  // Ferme le menu si clic en dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function handleSignOut() {
    await authClient.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B1929',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '64px 24px 48px',
      position: 'relative',
    }}>

      {/* Menu utilisateur — coin supérieur droit */}
      {session && (
        <div ref={menuRef} style={{ position: 'absolute', top: 20, right: 24, zIndex: 50 }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(196,154,46,0.25)',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: 24, height: 24,
              borderRadius: '50%',
              background: 'rgba(196,154,46,0.2)',
              border: '1.5px solid rgba(196,154,46,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#C49A2E', flexShrink: 0,
            }}>
              {session.name.charAt(0).toUpperCase()}
            </span>
            Bonjour, {session.name.split(' ')[0]}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginLeft: 2 }}>
              {menuOpen ? '▲' : '▼'}
            </span>
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: 160,
              background: '#0F2238',
              border: '1px solid rgba(196,154,46,0.2)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div style={{
                padding: '10px 14px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Connecté en tant que
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 2, wordBreak: 'break-all' }}>
                  {session.name}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#E07070',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.1s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,100,100,0.08)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 13 }}>↩</span>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      )}
      {/* En-tête identité */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 56 }}>
        <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 24 }}>
          <Image
            src="/report-assets/logo_sceau_blanc.png"
            alt="Century 21"
            fill
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: '#C49A2E',
          marginBottom: 8,
        }}>
          Century 21 · Groupe Martinot
        </div>
        <div style={{
          fontSize: 32,
          fontWeight: 800,
          color: '#FFFFFF',
          letterSpacing: '0.5px',
          marginBottom: 10,
        }}>
          Audit Comptable
        </div>
        <div style={{
          width: 48,
          height: 2,
          background: 'linear-gradient(90deg, #C49A2E, #A87E20)',
          borderRadius: 2,
        }} />
      </div>

      {/* Sous-titre */}
      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.45)',
        marginBottom: 40,
        letterSpacing: '0.3px',
      }}>
        Sélectionnez le type d&apos;audit
      </div>

      {/* Cards de sélection */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { mode: 'gerance', icon: '🏠', label: 'Gérance', sub: 'Analyse des mandats de gestion locative' },
          { mode: 'copro', icon: '🏢', label: 'Copropriété', sub: 'Analyse des comptes de copropriété' },
        ].map(({ mode, icon, label, sub }) => (
          <button
            key={mode}
            onClick={() => router.push(`/audit/${mode}`)}
            style={{
              width: 240,
              padding: '32px 28px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(196,154,46,0.25)',
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.18s',
              outline: 'none',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(196,154,46,0.08)'
              e.currentTarget.style.borderColor = 'rgba(196,154,46,0.6)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(196,154,46,0.15)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = 'rgba(196,154,46,0.25)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 14 }}>{icon}</div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: 8,
              letterSpacing: '0.3px',
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.5,
            }}>
              {sub}
            </div>
            <div style={{
              marginTop: 20,
              display: 'inline-block',
              padding: '7px 20px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #C49A2E, #A87E20)',
              color: '#0B1929',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              Démarrer →
            </div>
          </button>
        ))}
      </div>

      {/* Mémoire trimestrielle */}
      <div style={{ width: '100%', maxWidth: 600, marginTop: 48 }}>
        <QuarterlyMemory />
      </div>

      {/* Pied de page */}
      <div style={{
        marginTop: 48,
        fontSize: 10,
        color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.5px',
      }}>
        Century 21 · Groupe Martinot · Audit Comptable
      </div>
    </div>
  )
}
