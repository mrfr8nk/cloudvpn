CREATE OR REPLACE FUNCTION public.claim_file_download(p_code text, p_importer_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.claim_file_import(p_code, p_importer_hash) = 'new';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_file_download(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_file_download(text, text) TO service_role;
COMMENT ON FUNCTION public.claim_file_download(text, text) IS 'Compatibility wrapper: every request uses the strict atomic import claim; no free retry window.';