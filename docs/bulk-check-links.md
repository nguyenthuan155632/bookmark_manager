# Bulk Link Checking

The bulk link checking feature allows you to check the health status of multiple bookmarks at once, helping you identify broken links and maintain a clean bookmark collection.

## What is Bulk Link Checking?

Bulk link checking is a feature that:

- **Checks multiple bookmarks** simultaneously
- **Verifies link health** and accessibility
- **Updates status indicators** automatically
- **Handles protected bookmarks** with passcode verification
- **Processes in batches** to avoid overwhelming servers

## How to Use Bulk Link Checking

### From the API

1. **Make POST request** to `/api/bookmarks/bulk/check-links`
2. **Include bookmark IDs** in the request body
3. **Provide passcodes** for protected bookmarks if needed
4. **Wait for processing** to complete

### Request Format

```json
{
  "ids": [1, 2, 3, 4, 5],
  "passcodes": {
    "1": "mypasscode",
    "3": "anotherpasscode"
  }
}
```

### Response Format

```json
{
  "checkedIds": [1, 2, 3, 4, 5],
  "failed": []
}
```

## Features and Capabilities

### Batch Processing

- **Up to 50 bookmarks** per request
- **Concurrent checking** (5 at a time)
- **Rate limiting** to be respectful to servers
- **Progress tracking** for large batches

### Protected Bookmark Support

- **Passcode verification** for protected bookmarks
- **Account password** can also unlock bookmarks
- **Access control** before checking links
- **Error reporting** for access denied bookmarks

### Link Status Updates

- **Automatic status updates** after checking
- **HTTP status codes** recorded
- **Failure count** tracking
- **Last check timestamps** updated

## Link Status Types

### Working Links

- **Status**: "ok"
- **HTTP codes**: 200-299
- **Indicators**: Green checkmark
- **Action**: No action needed

### Broken Links

- **Status**: "broken"
- **HTTP codes**: 400-599
- **Indicators**: Red X or warning
- **Action**: Review and fix or remove

### Timeout Links

- **Status**: "timeout"
- **HTTP codes**: N/A (connection timeout)
- **Indicators**: Clock icon
- **Action**: Check network or retry later

### Unknown Status

- **Status**: "unknown"
- **HTTP codes**: N/A
- **Indicators**: Question mark
- **Action**: Manual verification needed

## Usage Examples

### Check All Bookmarks

```bash
POST /api/bookmarks/bulk/check-links
{
  "ids": []
}
```

### Check Specific Bookmarks

```bash
POST /api/bookmarks/bulk/check-links
{
  "ids": [1, 5, 10, 15, 20]
}
```

### Check Protected Bookmarks

```bash
POST /api/bookmarks/bulk/check-links
{
  "ids": [1, 2, 3],
  "passcodes": {
    "1": "secret123",
    "3": "mypassword"
  }
}
```

## Performance Considerations

### Rate Limiting

- **Built-in delays** between batches
- **Respectful crawling** of external sites
- **Server protection** against abuse
- **User-specific limits** to prevent overload

### Batch Size Limits

- **Maximum 50 bookmarks** per request
- **5 concurrent checks** at a time
- **2-second delays** between batches
- **Timeout handling** for slow responses

### Error Handling

- **Individual bookmark failures** don't stop the batch
- **Detailed error reporting** for each failure
- **Retry logic** for temporary failures
- **Graceful degradation** for problematic links

## Best Practices

### When to Use Bulk Checking

- **Regular maintenance** of your bookmark collection
- **After importing** large numbers of bookmarks
- **Before sharing** bookmark collections
- **Periodic cleanup** of broken links

### Efficient Usage

- **Check in smaller batches** for better performance
- **Focus on recent bookmarks** first
- **Use during off-peak hours** for better results
- **Monitor results** and take action on broken links

### Protected Bookmark Handling

- **Keep passcodes secure** and accessible
- **Use account password** when possible
- **Document passcodes** for important bookmarks
- **Regular passcode updates** for security

## Troubleshooting

### Common Issues

- **Access denied errors** for protected bookmarks
- **Timeout errors** for slow websites
- **Rate limiting** if too many requests
- **Network connectivity** issues

### Error Resolution

- **Check passcodes** for protected bookmarks
- **Verify network connection** and stability
- **Wait and retry** for rate-limited requests
- **Contact support** for persistent issues

### Performance Issues

- **Reduce batch size** if experiencing timeouts
- **Check during off-peak hours** for better performance
- **Monitor system resources** during large checks
- **Use smaller, more frequent** checks instead of large batches

## Integration and Automation

### API Integration

- **Automated checking** using scheduled scripts
- **Webhook integration** for status updates
- **Custom applications** using the API
- **Third-party tools** integration

### Monitoring and Alerts

- **Status change notifications** when links break
- **Regular health reports** of your collection
- **Automated cleanup** of broken links
- **Dashboard integration** for status overview

The bulk link checking feature helps you maintain a healthy and reliable bookmark collection by automatically identifying and reporting on the status of your links, ensuring your bookmarks remain useful and accessible over time.
