CREATE OR REPLACE FUNCTION public.claim_file_import(p_code text, p_importer_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.shared_files%ROWTYPE;
BEGIN
  IF p_importer_hash IS NULL OR p_importer_hash !~ '^[a-f0-9]{64}$' THEN RETURN 'invalid'; END IF;
  SELECT * INTO f FROM public.shared_files WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF f.expires_at <= clock_timestamp() THEN RETURN 'expired'; END IF;
  -- Every import counts toward the limit, including repeat imports by the same phone.
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