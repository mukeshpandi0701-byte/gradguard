-- Add email and phone to students table for notifications
ALTER TABLE students ADD COLUMN email TEXT;
ALTER TABLE students ADD COLUMN phone_number TEXT;

-- Add phone number to profiles table
ALTER TABLE profiles ADD COLUMN phone_number TEXT;

-- Update predictions table to allow deletion
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_student_id_fkey;
ALTER TABLE predictions
  ADD CONSTRAINT predictions_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES students(id)
  ON DELETE CASCADE;

-- Add RLS policy for deleting predictions
CREATE POLICY "Users can delete their own predictions"
ON predictions FOR DELETE
USING (auth.uid() = user_id);