# Supabase Setup Guide

To enable optional Cloud Backup, you need to connect your own Supabase project. PoopLog is fully functional without it, but configuring Supabase allows for encrypted manual backups.

## 1. Create a Supabase Project
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Under **Project Settings -> API**, copy your **Project URL** and **anon public key**.
3. Add these to your `.env` (or `.env.local`) file:
   ```env
   VITE_SUPABASE_URL="your-project-url"
   VITE_SUPABASE_ANON_KEY="your-anon-key"
   ```

## 2. Enable Authentication Providers
PoopLog supports Google and GitHub auth for cloud backup. 
1. Go to **Authentication -> Providers**.
2. Enable **Google** and/or **GitHub** (you will need to set up OAuth credentials with those services).
3. Set your Redirect URL in **Authentication -> URL Configuration** to match your app's deployed URL (or `http://localhost:3000` for local dev).

## 3. Create Storage Bucket
1. Go to **Storage**.
2. Create a new bucket named `backups`.
3. Set the bucket to **Private**.

## 4. Set up Row Level Security (RLS) for Storage
Your backups contain encrypted data, but you still want strict access control. Enable RLS and restrict every object to the authenticated user's first storage path segment (`${user.id}/...`).
Run the following SQL in the **SQL Editor** in Supabase:

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Each backup must be stored at: <auth.uid()>/<filename>
CREATE POLICY "Users can view their own backups"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'backups'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own backups"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'backups'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own backups"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'backups'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'backups'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own backups"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'backups'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

Once this is set up, the Cloud Backup settings inside PoopLog will become active automatically!
