import Image from 'next/image'

export function LoginBranding() {
  return (
    <div className="flex flex-col items-center mb-10">
      <div className="relative w-16 h-16 mb-5">
        <Image
          src="/report-assets/logo_sceau_blanc.png"
          alt="Century 21"
          fill
          className="object-contain"
        />
      </div>
      <p className="text-[10px] font-bold tracking-[3px] uppercase text-[#C49A2E] mb-1.5">
        Century 21 · Groupe Martinot
      </p>
      <h1 className="text-[26px] font-extrabold text-white tracking-wide mb-2">
        Audit Comptable
      </h1>
      <div className="w-10 h-0.5 rounded-sm" style={{ background: 'linear-gradient(90deg, #C49A2E, #A87E20)' }} />
    </div>
  )
}
