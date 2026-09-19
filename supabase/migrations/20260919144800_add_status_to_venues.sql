-- Migration to add 'status' for moderation in venues and venue_reviews

-- 1. Add status column to businesses if it doesn't exist
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- 2. Add status column to venue_reviews if it doesn't exist
ALTER TABLE public.venue_reviews 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- 3. Create an admin_roles table (optional, but good for moderation)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id uuid references auth.users not null primary key,
    role text not null default 'moderator',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: 
-- Enable RLS and add policies so that normal users only see 'approved' reviews,
-- but the author of the review can see their own 'pending' reviews.
-- For businesses, only show them on the platform if status = 'approved'.
