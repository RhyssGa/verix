import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  const user = session?.user ?? null
  const loading = isPending

  async function signOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/login')
        },
      },
    })
  }

  return { user, loading, signOut }
}
