
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS height numeric DEFAULT 170,
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 70,
  ADD COLUMN IF NOT EXISTS age integer DEFAULT 25,
  ADD COLUMN IF NOT EXISTS activity_level text DEFAULT 'Lightly Active',
  ADD COLUMN IF NOT EXISTS fitness_goal text DEFAULT 'Maintain',
  ADD COLUMN IF NOT EXISTS gender text DEFAULT 'Male';
