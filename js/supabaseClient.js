// Singleton de Supabase para toda la app.

const SUPABASE_URL = "https://gbezspywlvzzbrkfotxe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZXpzcHl3bHZ6emJya2ZvdHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NTcwMjUsImV4cCI6MjA3MjUzMzAyNX0.AsRlhIPl5GwpExTYU_MJW8pZ-5YsBIbionNe9Xsi7Rs";

// Cliente compartido
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);