import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sliaczjblzbxrddasank.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsaWFjempibHpieHJkZGFzYW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY4MjYxNCwiZXhwIjoyMTAxMjU4NjE0fQ.PhWPxzUU0lcSCefKPPBjfUDyrR9rPOFFaaHyEGbk0R8'
);

async function run() {
  const { data } = await supabase.from('exercises').select('*');
  console.log(data);
}

run();
