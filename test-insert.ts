import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uhqbveengyffhscijrrf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVocWJ2ZWVuZ3lmZmhzY2lqcnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjA1ODMsImV4cCI6MjA5MjI5NjU4M30.bKbYjzsQClshS0t4J_HiKQWHFjzCnqBW_uncnIEVxVU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('quotes')
    .insert([{
      client_name: 'Teste Local',
      status: 'rascunho',
      event_date: '2026-05-10',
      event_type: 'outro',
      guests: 10,
      duration_hours: 4,
      period: 'Manhã'
    }])
    .select()
    .single();

  if (error) {
    console.error("ERRO SUPABASE:", error);
  } else {
    console.log("SUCESSO:", data);
  }
}

run();
