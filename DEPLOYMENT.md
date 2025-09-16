# 🚀 Production Deployment Guide

## Full-Text Search Deployment

The full-text search feature requires additional database setup beyond the standard schema migration. Here's how to deploy it properly.

## 📋 Deployment Steps

### Option 1: Automated Deployment (Recommended)

```bash
# Deploy everything (schema + full-text search)
npm run deploy:full

# Or deploy just the full-text search (if schema is already up to date)
npm run deploy:search
```

### Option 2: Manual Step-by-Step

```bash
# 1. Deploy schema changes
npm run db:push

# 2. Deploy full-text search
npm run deploy:search
```

## 🔧 What the Deployment Does

The `deploy:search` script automatically:

1. ✅ **Checks** if search_vector column exists
2. ✅ **Adds** search_vector column if missing
3. ✅ **Converts** column to tsvector type if needed
4. ✅ **Creates** search vector update function
5. ✅ **Installs** automatic update trigger
6. ✅ **Creates** GIN index for fast searching
7. ✅ **Creates** user_id index for efficient filtering
8. ✅ **Updates** existing records with search vectors
9. ✅ **Verifies** installation success

## 🌍 Production Deployment

### For New Deployments

```bash
# Set production environment
export NODE_ENV=production

# Deploy everything
npm run deploy:full
```

### For Existing Deployments

```bash
# Set production environment
export NODE_ENV=production

# Deploy full-text search (safe to run multiple times)
npm run deploy:search
```

## 🐳 Docker Deployment

Add to your Dockerfile:

```dockerfile
# After building your app
RUN npm run deploy:search
```

Or add to your docker-compose.yml:

```yaml
services:
  app:
    # ... your app config
    command: sh -c "npm run deploy:search && npm start"
```

## ☁️ Cloud Platform Deployment

### Vercel

Add to your `vercel.json`:

```json
{
  "buildCommand": "npm run build && npm run deploy:search",
  "installCommand": "npm install"
}
```

### Railway

Add to your `railway.toml`:

```toml
[build]
buildCommand = "npm run build && npm run deploy:search"
```

### Heroku

Add to your `package.json`:

```json
{
  "scripts": {
    "postinstall": "npm run deploy:search"
  }
}
```

## 🔍 Verification

After deployment, verify the installation:

```bash
# Test the search functionality
npx tsx server/scripts/test-partial-search.ts
```

## 🚨 Troubleshooting

### Common Issues

1. **Permission Denied**

   ```bash
   # Ensure your DATABASE_URL has proper permissions
   # The user needs CREATE, ALTER, and INDEX privileges
   ```

2. **Column Already Exists**

   ```bash
   # This is normal - the script handles existing installations
   # It will convert the column type if needed
   ```

3. **Trigger Already Exists**
   ```bash
   # The script drops and recreates triggers
   # This ensures the latest version is installed
   ```

### Manual Verification

Check if full-text search is working:

```sql
-- Check if search_vector column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookmarks' AND column_name = 'search_vector';

-- Check if GIN index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'bookmarks' AND indexname = 'bookmarks_search_idx';

-- Test search functionality
SELECT name, ts_rank(search_vector, plainto_tsquery('english', 'test')) as rank
FROM bookmarks
WHERE search_vector @@ plainto_tsquery('english', 'test')
ORDER BY rank DESC;
```

## 📊 Performance Notes

- **GIN Index**: Provides fast full-text search performance
- **User ID Index**: Ensures efficient filtering by user
- **Trigger**: Automatically updates search vectors on data changes
- **Hybrid Search**: Combines full-text search with ILIKE for partial matches

## 🔄 Rollback (If Needed)

If you need to rollback the full-text search:

```sql
-- Remove the trigger
DROP TRIGGER IF EXISTS update_bookmark_search_vector_trigger ON bookmarks;

-- Remove the function
DROP FUNCTION IF EXISTS update_bookmark_search_vector();

-- Remove the indexes
DROP INDEX IF EXISTS bookmarks_search_idx;
DROP INDEX IF EXISTS bookmarks_user_id_idx;

-- Remove the column (optional - will lose search data)
ALTER TABLE bookmarks DROP COLUMN IF EXISTS search_vector;
```

## ✅ Success Checklist

After deployment, verify:

- [ ] Search vector column exists and is tsvector type
- [ ] GIN index is created
- [ ] Trigger is installed and working
- [ ] Existing records have search vectors
- [ ] Search functionality works in the app
- [ ] Partial word searches work (e.g., "supply" finds "supply-chain")

Your full-text search is now ready for production! 🎉
