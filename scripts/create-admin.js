/**
 * Arena 151 Admin Account Creator
 * Creates a user in Supabase Auth and grants admin privileges
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ADMIN_EMAIL = 'blacklivesmatteretsy@gmail.com';
const ADMIN_PASSWORD = '0439Fole1!';

async function createAdminUser() {
  console.log('🚀 Creating admin account for Arena 151...\n');

  try {
    // Step 1: Create user in Supabase Auth
    console.log('Step 1: Creating user account...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
        console.log('⚠️  User already exists, skipping creation');
      } else {
        throw authError;
      }
    } else {
      console.log('✅ User created:', authData.user.id);
    }

    // Get user ID (either from creation or fetch existing)
    let userId;
    if (authData?.user?.id) {
      userId = authData.user.id;
    } else {
      // Fetch existing user
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users?.users.find(u => u.email === ADMIN_EMAIL);
      if (existingUser) {
        userId = existingUser.id;
        console.log('✅ Found existing user:', userId);
      } else {
        throw new Error('Could not find or create user');
      }
    }

    // Step 2: Ensure profile exists
    console.log('\nStep 2: Checking profile...');
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      console.log('Creating profile...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: ADMIN_EMAIL,
          username: ADMIN_EMAIL.split('@')[0],
          is_admin: true,
        });

      if (profileError) throw profileError;
      console.log('✅ Profile created');
    } else {
      console.log('✅ Profile exists');
    }

    // Step 3: Grant admin privileges
    console.log('\nStep 3: Granting admin privileges...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', userId);

    if (updateError) throw updateError;
    console.log('✅ Admin privileges granted');

    // Step 4: Verify
    console.log('\nStep 4: Verifying...');
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, username, is_admin')
      .eq('id', userId)
      .single();

    if (profile?.is_admin) {
      console.log('✅ Verification successful!\n');
      console.log('📊 Admin Account Details:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Email:    ${ADMIN_EMAIL}`);
      console.log(`Password: ${ADMIN_PASSWORD}`);
      console.log(`User ID:  ${userId}`);
      console.log(`Admin:    ${profile.is_admin ? 'YES ✓' : 'NO ✗'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('🎉 SUCCESS! You can now login at:');
      console.log('   http://localhost:3002/login\n');
    } else {
      throw new Error('Admin flag not set correctly');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check SUPABASE_SERVICE_KEY in .env.local');
    console.error('2. Verify Supabase project URL is correct');
    console.error('3. Ensure profiles table exists (run migration 016)');
    process.exit(1);
  }
}

createAdminUser();
