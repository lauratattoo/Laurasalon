CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE TABLE public.laura_settings(id integer PRIMARY KEY, value text NOT NULL);
CREATE TABLE public.laura_bookings(id text PRIMARY KEY,value text NOT NULL,
 day text GENERATED ALWAYS AS (value::jsonb->>'date') STORED,
 start_min integer GENERATED ALWAYS AS (split_part(value::jsonb->>'start',':',1)::integer*60+split_part(value::jsonb->>'start',':',2)::integer) STORED,
 end_min integer GENERATED ALWAYS AS (split_part(value::jsonb->>'end',':',1)::integer*60+split_part(value::jsonb->>'end',':',2)::integer) STORED,
 active boolean GENERATED ALWAYS AS ((value::jsonb->>'status') IN ('confirmed','blocked')) STORED,
 CHECK(start_min>=0 AND end_min<=1440 AND start_min<end_min));
SET search_path=public,extensions;
ALTER TABLE public.laura_bookings ADD CONSTRAINT laura_no_overlap EXCLUDE USING gist(day WITH =, int4range(start_min,end_min,'[)') WITH &&) WHERE(active);
CREATE TABLE public.laura_uploads(id text PRIMARY KEY,mime text NOT NULL,bytes text NOT NULL,public integer NOT NULL CHECK(public IN (0,1)));
CREATE TABLE public.laura_mail(id text PRIMARY KEY,payload text NOT NULL,state text NOT NULL,attempts integer DEFAULT 0,error text,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.laura_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laura_settings FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.laura_settings TO service_role;
ALTER TABLE public.laura_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laura_bookings FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.laura_bookings TO service_role;
ALTER TABLE public.laura_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laura_uploads FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.laura_uploads TO service_role;
ALTER TABLE public.laura_mail ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laura_mail FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.laura_mail TO service_role;
CREATE FUNCTION public.laura_query(operations jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE op jsonb; statement text; p jsonb; result jsonb; results jsonb='[]'::jsonb;
BEGIN
 IF jsonb_typeof(operations)<>'array' OR jsonb_array_length(operations)>30 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
 FOR op IN SELECT value FROM jsonb_array_elements(operations) LOOP
  p=op->'params';
  statement=CASE op->>'sql'
WHEN 'SELECT id FROM settings' THEN 'SELECT id FROM public.laura_settings'
WHEN 'INSERT INTO settings VALUES(1,?)' THEN 'INSERT INTO public.laura_settings(id,value) VALUES(1,$1) ON CONFLICT(id) DO NOTHING'
WHEN 'SELECT value FROM settings WHERE id=1' THEN 'SELECT value FROM public.laura_settings WHERE id=1'
WHEN 'SELECT value FROM bookings' THEN 'SELECT value FROM public.laura_bookings'
WHEN 'INSERT OR REPLACE INTO bookings VALUES(?,?)' THEN 'INSERT INTO public.laura_bookings(id,value) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value'
WHEN 'INSERT INTO uploads VALUES(?,?,?,?)' THEN 'INSERT INTO public.laura_uploads(id,mime,bytes,public) VALUES($1,$2,$3,$4::integer)'
WHEN 'INSERT OR IGNORE INTO mail(id,payload,state) VALUES(?,?,?)' THEN 'INSERT INTO public.laura_mail(id,payload,state) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING'
WHEN 'SELECT * FROM mail WHERE state=''pending'' AND attempts<6 LIMIT 5' THEN 'SELECT * FROM public.laura_mail WHERE state=''pending'' AND attempts<6 LIMIT 5'
WHEN 'UPDATE mail SET state=''sent'',error=NULL WHERE id=?' THEN 'UPDATE public.laura_mail SET state=''sent'',error=NULL WHERE id=$1'
WHEN 'UPDATE mail SET attempts=attempts+1,error=? WHERE id=?' THEN 'UPDATE public.laura_mail SET attempts=attempts+1,error=$1 WHERE id=$2'
WHEN 'SELECT id,state,attempts,error FROM mail ORDER BY rowid DESC LIMIT 100' THEN 'SELECT id,state,attempts,error FROM public.laura_mail ORDER BY created_at DESC LIMIT 100'
WHEN 'UPDATE settings SET value=? WHERE id=1' THEN 'UPDATE public.laura_settings SET value=$1 WHERE id=1'
WHEN 'DELETE FROM uploads WHERE id=?' THEN 'DELETE FROM public.laura_uploads WHERE id=$1'
WHEN 'DELETE FROM bookings WHERE id=?' THEN 'DELETE FROM public.laura_bookings WHERE id=$1'
WHEN 'DELETE FROM mail WHERE payload LIKE ?' THEN 'DELETE FROM public.laura_mail WHERE payload LIKE $1'
WHEN 'UPDATE mail SET attempts=0 WHERE state=''pending''' THEN 'UPDATE public.laura_mail SET attempts=0 WHERE state=''pending'''
WHEN 'SELECT * FROM uploads WHERE id=?' THEN 'SELECT * FROM public.laura_uploads WHERE id=$1' ELSE NULL END;
  IF statement IS NULL THEN RAISE EXCEPTION 'Unsupported query'; END IF;
  IF statement LIKE 'SELECT %' THEN
   EXECUTE 'SELECT coalesce(jsonb_agg(q), ''[]''::jsonb) FROM ('||statement||') q' INTO result USING p->>0,p->>1,p->>2,p->>3;
  ELSE
   EXECUTE statement USING p->>0,p->>1,p->>2,p->>3;
   result='[]'::jsonb;
  END IF;
  results=results||jsonb_build_array(result);
 END LOOP;
 RETURN results;
END;
$fn$;
REVOKE ALL ON FUNCTION public.laura_query(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.laura_query(jsonb) TO service_role;
