CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Untitled board',
  type text NOT NULL DEFAULT 'blank',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  canvas_settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  type text NOT NULL,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  w double precision NOT NULL DEFAULT 180,
  h double precision NOT NULL DEFAULT 170,
  z integer NOT NULL DEFAULT 0,
  colour text NOT NULL DEFAULT '#FFFFFF',
  rotation double precision NOT NULL DEFAULT 0,
  parent_id uuid,
  tags text[] NOT NULL DEFAULT '{}',
  pinned boolean NOT NULL DEFAULT false,
  collapsed boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_board_id_idx ON public.items(board_id);

CREATE TABLE public.app_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only the app's server (after checking the access code session) may touch these tables.
GRANT ALL ON public.boards TO service_role;
GRANT ALL ON public.items TO service_role;
GRANT ALL ON public.app_meta TO service_role;
REVOKE ALL ON public.boards FROM anon, authenticated;
REVOKE ALL ON public.items FROM anon, authenticated;
REVOKE ALL ON public.app_meta FROM anon, authenticated;

-- RLS on with no policies = closed to the public API keys; the server role bypasses it.
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_meta ENABLE ROW LEVEL SECURITY;