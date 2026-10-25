CREATE TABLE public.shared_files (
  code text PRIMARY KEY,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  downloads integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shared_files TO service_role;
ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;