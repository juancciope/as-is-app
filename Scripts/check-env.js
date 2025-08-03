#!/usr/bin/env node

console.log('🔍 Environment Variables Check\n');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const optionalVars = [
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'OPENAI_API_KEY'
];

console.log('✅ Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const display = value ? `${value.substring(0, 20)}...` : 'NOT SET';
  console.log(`  ${status} ${varName}: ${display}`);
});

console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '⚠️';
  const display = value ? `${value.substring(0, 20)}...` : 'NOT SET';
  console.log(`  ${status} ${varName}: ${display}`);
});

// Check if .env.local file exists
const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env.local');

console.log('\n📄 Environment File:');
if (fs.existsSync(envPath)) {
  console.log('  ✅ .env.local file exists');
  
  const content = fs.readFileSync(envPath, 'utf8');
  const hasSupabaseUrl = content.includes('NEXT_PUBLIC_SUPABASE_URL=');
  const hasSupabaseKey = content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=');
  
  console.log(`  ${hasSupabaseUrl ? '✅' : '❌'} Contains NEXT_PUBLIC_SUPABASE_URL`);
  console.log(`  ${hasSupabaseKey ? '✅' : '❌'} Contains NEXT_PUBLIC_SUPABASE_ANON_KEY`);
} else {
  console.log('  ❌ .env.local file not found');
}

const missingRequired = requiredVars.filter(varName => !process.env[varName]);
if (missingRequired.length > 0) {
  console.log('\n❌ Missing required environment variables:');
  missingRequired.forEach(varName => {
    console.log(`  - ${varName}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 All required environment variables are set!');
}