'use client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { QuarterlyMemory } from '@/components/home/QuarterlyMemory'

export default function HomePage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B1929',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '64px 24px 48px',
    }}>
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
