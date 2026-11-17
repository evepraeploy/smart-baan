create extension if not exists pg_cron;

select cron.schedule(
  'generate-monthly-bills',
  '0 17 24 * *',
  'select public.generate_monthly_bills();'
);
