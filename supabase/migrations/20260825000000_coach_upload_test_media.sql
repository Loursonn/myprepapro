-- Make test-media bucket public so getPublicUrl works for session images
UPDATE storage.buckets SET public = true WHERE id = 'test-media';

-- Allow coaches to upload to test-media bucket in their own folder
CREATE POLICY "coach_upload_test_media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'test-media' AND
    (storage.foldername(name))[1] = auth.uid()::text AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Allow coaches to read files they uploaded
CREATE POLICY "coach_read_test_media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'test-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow coaches to delete files they uploaded
CREATE POLICY "coach_delete_test_media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'test-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
