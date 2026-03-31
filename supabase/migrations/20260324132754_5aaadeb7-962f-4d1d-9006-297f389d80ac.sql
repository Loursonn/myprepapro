-- Simple key-value store for workout tracker data
CREATE TABLE public.app_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read and write (no auth needed for single-user app)
CREATE POLICY "Allow public read" ON public.app_data FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.app_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.app_data FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.app_data FOR DELETE USING (true);