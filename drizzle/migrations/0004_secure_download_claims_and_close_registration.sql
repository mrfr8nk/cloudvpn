ALTER TABLE public.shared_files ADD COLUMN IF NOT EXISTS importer_hash text;
ALTER TABLE public.shared_files ADD COLUMN IF NOT EXISTS expiry_minutes integer NOT NULL DEFAULT 30;
COMMENT ON COLUMN public.shared_files.importer_hash IS 'SHA-256 of first importing network and app identity; a deterrent, not a device ID.';
CREATE OR REPLACE FUNCTION public.set_shared_file_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.created_at := clock_timestamp();
  NEW.expires_at := NEW.created_at + make_interval(mins => LEAST(43200, GREATEST(1, NEW.expiry_minutes)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER shared_file_expiry_on_insert BEFORE INSERT ON public.shared_files FOR EACH ROW EXECUTE FUNCTION public.set_shared_file_expiry();
CREATE OR REPLACE FUNCTION public.claim_file_download(p_code text, p_importer_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed text;
BEGIN
  IF p_importer_hash IS NULL OR p_importer_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  UPDATE public.shared_files
  SET downloads = downloads + 1, importer_hash = COALESCE(importer_hash, p_importer_hash)
  WHERE code = p_code AND expires_at > clock_timestamp()
    AND (max_downloads IS NULL OR downloads < max_downloads)
    AND (importer_hash IS NULL OR importer_hash = p_importer_hash)
  RETURNING code INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_file_download(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_file_download(text, text) TO service_role;
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Account registration is closed';
END;
$$;
COMMENT ON FUNCTION public.assign_first_admin() IS 'Registration closed after admin setup; existing accounts and admin roles are retained.';