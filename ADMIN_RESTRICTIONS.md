# Admin Restrictions for Domain Tags

## Overview

Domain tag management has been restricted to ensure only the admin user can modify or delete domain tags, while allowing all authenticated users to add new domain tags and view existing ones.

## Admin User

- **Username**: `vensera`
- **Permissions**: Full access to all domain tag operations
- **Actions**: Can create, read, update, delete, and perform bulk operations

## Regular Users

- **Permissions**: Limited access to domain tag operations
- **Actions**: Can create and read domain tags only

## API Endpoint Restrictions

### ✅ All Users Can Access

| Method | Endpoint                      | Description                     | Middleware    |
| ------ | ----------------------------- | ------------------------------- | ------------- |
| `GET`  | `/api/domain-tags`            | List domain tags with filtering | `requireAuth` |
| `GET`  | `/api/domain-tags/categories` | Get unique categories           | `requireAuth` |
| `GET`  | `/api/domain-tags/suggest`    | Get domain suggestions          | `requireAuth` |
| `POST` | `/api/domain-tags`            | Create new domain tag           | `requireAuth` |

### 🔒 Admin Only (vensera)

| Method   | Endpoint                | Description       | Middleware     |
| -------- | ----------------------- | ----------------- | -------------- |
| `PATCH`  | `/api/domain-tags/:id`  | Update domain tag | `requireAdmin` |
| `DELETE` | `/api/domain-tags/:id`  | Delete domain tag | `requireAdmin` |
| `POST`   | `/api/domain-tags/bulk` | Bulk operations   | `requireAdmin` |

## Error Responses

### Authentication Required (401)

```json
{
  "message": "Authentication required"
}
```

### Admin Access Required (403)

```json
{
  "message": "Admin access required. Only the admin user can perform this action."
}
```

## Implementation Details

### Middleware Functions

#### `requireAuth`

- Checks if user is authenticated
- Returns 401 if not authenticated
- Allows all authenticated users to proceed

#### `requireAdmin`

- Checks if user is authenticated
- Returns 401 if not authenticated
- Checks if username is exactly "vensera"
- Returns 403 if not admin user
- Allows only admin user to proceed

### Code Example

```typescript
// Regular user access
app.get('/api/domain-tags', requireAuth, handler);

// Admin only access
app.patch('/api/domain-tags/:id', requireAdmin, handler);
app.delete('/api/domain-tags/:id', requireAdmin, handler);
app.post('/api/domain-tags/bulk', requireAdmin, handler);
```

## Frontend Behavior

### For Regular Users

- ✅ Can view domain tags page
- ✅ Can add new domain tags
- ✅ Can see domain suggestions in bookmark modal
- ❌ Cannot edit existing domain tags
- ❌ Cannot delete domain tags
- ❌ Cannot perform bulk operations

### For Admin User (vensera)

- ✅ Full access to all domain tag management features
- ✅ Can edit existing domain tags
- ✅ Can delete domain tags
- ✅ Can perform bulk operations

## Testing

### Manual Testing

1. Login as regular user → Try to edit/delete domain tags → Should get 403 error
2. Login as admin user (vensera) → Try to edit/delete domain tags → Should work
3. Test API endpoints directly with different user credentials

### Automated Testing

```bash
# Test admin restrictions
npx tsx server/scripts/test-admin-restrictions.ts

# Test API middleware
npx tsx server/scripts/test-api-admin-restrictions.ts
```

## Security Considerations

1. **Username-based restriction**: Currently uses exact username match "vensera"
2. **Session-based**: Relies on Express session authentication
3. **No role system**: Simple username check, not a full role-based system
4. **Future enhancement**: Could be extended to use a proper role system

## Migration Notes

- Existing domain tags remain accessible to all users
- Only modification operations are restricted
- No data migration required
- Backward compatible with existing functionality
