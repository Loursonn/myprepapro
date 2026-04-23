-- Bucket Supabase Storage pour les médias des tests (images, PDFs de protocole)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-media',
  'test-media',
  false,
  10485760, -- 10 MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS : l'athlète peut uploader dans son propre dossier
CREATE POLICY "athlete_upload_test_media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'test-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS : l'athlète et son coach peuvent lire
CREATE POLICY "athlete_read_test_media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'test-media' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.coach_id IS NOT NULL
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM profiles WHERE coach_id = auth.uid()
        )
      )
    )
  );

-- RLS : suppression par l'athlète propriétaire
CREATE POLICY "athlete_delete_test_media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'test-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
