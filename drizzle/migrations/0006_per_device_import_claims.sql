CREATE TABLE IF NOT EXISTS public.shared_file_importers (
  code text NOT NULL REFERENCES public.shared_files(code) ON DELETE CASCADE,
  importer_hash text NOT NULL,
  first_claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (code, importer_hash)
);
GRANT ALL ON public.shared_file_importers TO service_role;
ALTER TABLE public.shared_file_importers ENABLE ROW LEVEL SECURITY;
COMMENT ON COLUMN public.shared_files.importer_hash IS 'DEPRECATED: first device only; per-device claims live in shared_file_importers.';

CREATE OR REPLACE FUNCTION public.claim_file_import(p_code text, p_importer_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.shared_files%ROWTYPE; prev timestamptz;
BEGIN
  IF p_importer_hash IS NULL OR p_importer_hash !~ '^[a-f0-9]{64}$' THEN RETURN 'invalid'; END IF;
  SELECT * INTO f FROM public.shared_files WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF f.expires_at <= clock_timestamp() THEN RETURN 'expired'; END IF;
  SELECT first_claimed_at INTO prev FROM public.shared_file_importers WHERE code = p_code AND importer_hash = p_importer_hash;
  -- A device that already received the file may re-import for 10 minutes without using another download.
  IF prev IS NOT NULL AND prev > clock_timestamp() - interval '10 minutes' THEN RETURN 'retry'; END IF;
  IF f.max_downloads IS NOT NULL AND f.downloads >= f.max_downloads THEN RETURN 'used_up'; END IF;
  UPDATE public.shared_files
    SET downloads = downloads + 1,
        importer_hash = COALESCE(importer_hash, p_importer_hash),
        first_claimed_at = COALESCE(first_claimed_at, clock_timestamp())
    WHERE code = p_code;
  INSERT INTO public.shared_file_importers (code, importer_hash) VALUES (p_code, p_importer_hash)
    ON CONFLICT (code, importer_hash) DO UPDATE SET first_claimed_at = clock_timestamp();
  RETURN 'new';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_file_import(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_file_import(text, text) TO service_role;