-- =============================================
-- Portfolio Database Schema for Supabase
-- =============================================
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PORTFOLIO ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('photo', 'video', 'editing')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('image', 'video')),
  thumbnail_url TEXT NOT NULL,
  fullsize_url TEXT NOT NULL,
  video_url TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio_items(category);
CREATE INDEX IF NOT EXISTS idx_portfolio_order ON portfolio_items(display_order);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read portfolio items
CREATE POLICY "Portfolio items are viewable by everyone"
  ON portfolio_items
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert
CREATE POLICY "Authenticated users can insert portfolio items"
  ON portfolio_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can update
CREATE POLICY "Authenticated users can update portfolio items"
  ON portfolio_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only authenticated users can delete
CREATE POLICY "Authenticated users can delete portfolio items"
  ON portfolio_items
  FOR DELETE
  TO authenticated
  USING (true);

-- =============================================
-- STORAGE BUCKET SETUP
-- =============================================
-- Note: Run these in Supabase Dashboard > Storage

-- 1. Create a bucket named 'portfolio'
-- 2. Set it to PUBLIC
-- 3. Add the following policies:

-- Policy for public read access:
-- bucket_id = 'portfolio' AND auth.role() = 'anon'

-- Policy for authenticated upload:
-- bucket_id = 'portfolio' AND auth.role() = 'authenticated'

-- =============================================
-- SAMPLE DATA (Optional)
-- =============================================
-- Uncomment to add sample portfolio items

/*
INSERT INTO portfolio_items (title, category, type, thumbnail_url, fullsize_url) VALUES
  ('Urban Dreams', 'photo', 'image', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=450&fit=crop', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=1080&fit=crop'),
  ('Golden Hour', 'photo', 'image', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=450&fit=crop', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop'),
  ('Wedding Film', 'video', 'video', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=450&fit=crop', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1920&h=1080&fit=crop'),
  ('Portrait Series', 'photo', 'image', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=450&fit=crop', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1920&h=1080&fit=crop'),
  ('Commercial Edit', 'editing', 'video', 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&h=450&fit=crop', 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1920&h=1080&fit=crop'),
  ('Nature Documentary', 'video', 'video', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=450&fit=crop', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop');
*/

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
