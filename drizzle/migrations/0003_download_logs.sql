CREATE TABLE public.download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  ip text,
  allowed boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX download_logs_code_idx ON public.download_logs(code, created_at DESC);
GRANT ALL ON public.download_logs TO service_role;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;