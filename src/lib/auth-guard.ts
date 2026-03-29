import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function requireAuth(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return {
      session: null,
      user: null,
      error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }),
    }
  }

  return { session, user: session.user, error: null }
}
