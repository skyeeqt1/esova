// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dvdkudyuzikvpyvopqnm.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZGt1ZHl1emlrdnB5dm9wcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDIzMTQsImV4cCI6MjA4OTcxODMxNH0.T8wgBO2Q1yim4rNaBHVb98fEMb1FVEgJ5ZptiD2ZFtU';

// Export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For storage, use supabase.storage from the bucket
export const storage = supabase.storage;
