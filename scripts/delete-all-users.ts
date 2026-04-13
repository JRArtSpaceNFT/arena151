import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://abzurjxkxxtahdjrpvxk.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFienVyanhreHh0YWhkanJwdnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE3MTM2MSwiZXhwIjoyMDkwNzQ3MzYxfQ.6X0Qfvu2J58Fs0Md7Hc4v7EW6md96LujQxCuw_qM6ig'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deleteAllUsers() {
  console.log('🗑️  Deleting all data from Arena151...')
  
  // Order matters: delete child tables first, then parent tables
  const tables = [
    'audit_log',
    'chat_reports', 
    'chat_messages',
    'matches',
    'profiles',
  ]
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (error) {
      console.error(`Error deleting ${table}:`, error)
    } else {
      console.log(`✅ All ${table} deleted`)
    }
  }
  
  // Delete all auth users
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }
  
  console.log(`\nFound ${users.users.length} auth users to delete`)
  
  for (const user of users.users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      console.error(`❌ Error deleting user ${user.email}:`, error.message)
    } else {
      console.log(`✅ Deleted: ${user.email}`)
    }
  }
  
  console.log('\n🎉 Complete! All users and data deleted. Fresh start ready.')
}

deleteAllUsers()
