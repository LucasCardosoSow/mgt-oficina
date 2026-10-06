// =====================================================================
// Configuração da oficina. Preencha com os dados do seu projeto Supabase
// (Supabase > Project Settings > API).
// A chave "anon" é pública por natureza; quem protege os dados são as
// regras de segurança do banco (schema.sql).
// =====================================================================

export const SUPABASE_URL = 'https://jbyumozrnjviivdobiqd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieXVtb3pybmp2aWl2ZG9iaXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU5NzMsImV4cCI6MjEwNjg3MTk3M30.SJnD93rbUKz0LlZCsdn1zjXA7oehhozTLv0ev0ilQ7k';

export const OFICINA = {
  nome: 'MGT Auto Elétrica',
  desde: '2005',
  // WhatsApp da oficina, só números com DDD (ex.: 41999990000).
  // Aparece no botão "Falar com a oficina" do link do cliente.
  whatsapp: '41992556828',
  endereco: 'Rua Eliud Alves Pereira, 581 · São José dos Pinhais - PR',
};
