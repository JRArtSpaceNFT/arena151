const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function findUser() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, balance, locked_balance')
    .eq('username', 'RareCandyClub')
    .single()
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('RareCandyClub profile:', data)
  
  // Now get the auth user email
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(data.id)
  
  if (authError) {
    console.error('Auth error:', authError)
    return
  }
  
  console.log('\nAuth email:', authUser.user.email)
  console.log('User ID:', data.id)
}

findUser()
