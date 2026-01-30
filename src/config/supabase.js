import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vcluoryjyqsbupracgqh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbHVvcnlqeXFzYnVwcmFjZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MzY1MzcsImV4cCI6MjA4NTMxMjUzN30.8gNW7cyxgUygQkmWPijb5bBP3kFowvsbkMcjcaoxLpE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
