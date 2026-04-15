// هذا الملف يهيّئ عميل Supabase ويجعله متاحاً في كل الصفحات
// عبر window.supabaseClient. يجب تحميل مكتبة Supabase من CDN قبل هذا الملف.
// المفتاح العام (anon key) آمن في الكود لأن الحماية الفعلية تتم
// عبر Row Level Security في قاعدة البيانات.

const SUPABASE_URL = 'https://gijrmaazjarsthksvfzt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpanJtYWF6amFyc3Roa3N2Znp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjg0OTYsImV4cCI6MjA5MTg0NDQ5Nn0.XHWdVxVfOcvST6ntqs0LrI5SylYrK33M6XQW7HHo_qU';

// ننشئ العميل ونخزنه في window حتى تقدر بقية الملفات تستخدمه
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
