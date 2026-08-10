// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js';

// Load from environment (see .env.example). Never hardcode credentials here —
// they would be baked into the app bundle and committed to git.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.'
  );
}

// Export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket used for candidate profile images. Keep in sync with the
// bucket created in the Supabase dashboard.
export const CANDIDATE_IMAGES_BUCKET = 'candidate-images';

// For storage, use supabase.storage from the bucket
export const storage = supabase.storage;
