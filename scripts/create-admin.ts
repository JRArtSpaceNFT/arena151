import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://abzurjxkxxtahdjrpvxk.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFienVyanhreHh0YWhkanJwdnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE3MTM2MSwiZXhwIjoyMDkwNzQ3MzYxfQ.6X0Qfvu2J58Fs0Md7Hc4v7EW6md96LujQxCuw_qM6ig'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdmin() {
  console.log('👑 Creating admin auth account...')
  
  const email = 'jfole001@gmail.com'
  const password = 'DontForget1!'
  
  // First, check if user exists and delete
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users.find(u => u.email === email)
  
  if (existingUser) {
    console.log('🗑️  Deleting existing user...')
    await supabase.auth.admin.deleteUser(existingUser.id)
    console.log('✅ Old user deleted')
  }
  
  // Create auth user ONLY - let the app signup flow create the profile
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email so they can log in immediately
    user_metadata: {
      is_admin: true, // Store admin flag in user metadata
    }
  })
  
  if (authError) {
    console.error('❌ Error creating auth user:', authError)
    return
  }
  
  console.log('✅ Auth user created:', authData.user.id)
  console.log('\n🎉 Admin account ready!')
  console.log(`📧 Email: ${email}`)
  console.log(`🔑 Password: ${password}`)
  console.log('\n📝 Next steps:')
  console.log('1. Go to https://arena151.xyz')
  console.log('2. Click "Log In" and enter the credentials above')
  console.log('3. Complete the signup flow (pick trainer, etc.)')
  console.log('4. Your account will be ready!')
}

createAdmin()
