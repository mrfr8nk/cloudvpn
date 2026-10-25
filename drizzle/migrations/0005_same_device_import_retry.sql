ALTER TABLE public.shared_files ADD COLUMN IF NOT EXISTS first_claimed_at timestamptz;
COMMENT ON COLUMN public.shared_files.first_claimed_at IS 'When the first importer received the file; starts the same-importer retry window.';
CREATE OR REPLACE FUNCTION public.claim_file_download(p_code text, p_importer_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed text;
BEGIN
  IF p_importer_hash IS NULL OR p_importer_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  UPDATE public.shared_files
  SET downloads = downloads + 1,
      importer_hash = COALESCE(importer_hash, p_importer_hash),
      first_claimed_at = COALESCE(first_claimed_at, clock_timestamp())
  WHERE code = p_code AND expires_at > clock_timestamp()
    AND (max_downloads IS NULL OR downloads < max_downloads)
    AND (importer_hash IS NULL OR importer_hash = p_importer_hash)
  RETURNING code INTO claimed;
  IF claimed IS NOT NULL THEN RETURN true; END IF;
  -- Same importer may re-fetch for 10 minutes after first import (failed or retried import) without using a download.
  RETURN EXISTS (
    SELECT 1 FROM public.shared_files
    WHERE code = p_code AND expires_at > clock_timestamp()
      AND importer_hash = p_importer_hash
      AND first_claimed_at > clock_timestamp() - interval '10 minutes'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_file_download(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_file_download(text, text) TO service_role;