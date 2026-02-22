import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/require-auth'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ profile: null }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ profile: null })
    }

    const { data, error } = await supabaseAdmin
      .from('student_profiles')
      .select('*')
      .eq('student_id', user.userId)
      .single()

    if (error || !data) {
      return NextResponse.json({ profile: null })
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    console.error('[api/profile] Error:', error)
    return NextResponse.json({ profile: null }, { status: 500 })
  }
}
