# Exporting Bookmarks

Memorize Vault allows you to export your bookmarks in multiple formats, making it easy to backup your data, migrate to other systems, or share your bookmark collection.

## Export Formats

### JSON Format (Default)
- **Complete data** including all metadata
- **Structured format** for easy processing
- **Includes** categories, tags, descriptions, and settings
- **Best for** backups and data migration

### CSV Format
- **Spreadsheet compatible** format
- **Essential fields** only (name, URL, description, tags)
- **Easy to open** in Excel, Google Sheets, etc.
- **Best for** sharing and basic analysis

## How to Export

### From the API
1. **Make request** to `/api/bookmarks/export`
2. **Add format parameter**: `?format=json` or `?format=csv`
3. **Optional category filter**: `?categoryId=123`
4. **Download** the response file

### Export All Bookmarks
```bash
# JSON format (default)
GET /api/bookmarks/export

# CSV format
GET /api/bookmarks/export?format=csv
```

### Export by Category
```bash
# Export specific category
GET /api/bookmarks/export?categoryId=123&format=json

# Export uncategorized bookmarks
GET /api/bookmarks/export?categoryId=uncategorized&format=csv
```

## Export Data Structure

### JSON Format Fields
- **id**: Unique bookmark identifier
- **name**: Bookmark title
- **url**: Website URL
- **description**: Bookmark description
- **tags**: Array of tags
- **isFavorite**: Favorite status
- **categoryId**: Category ID (if assigned)
- **category**: Category name (if assigned)
- **isShared**: Sharing status
- **screenshotUrl**: Screenshot URL
- **linkStatus**: Link health status
- **createdAt**: Creation timestamp
- **updatedAt**: Last update timestamp

### CSV Format Fields
- **name**: Bookmark title
- **url**: Website URL
- **description**: Bookmark description
- **tags**: Comma-separated tags
- **isFavorite**: True/False
- **category**: Category name
- **createdAt**: Creation date

## Category Filtering

### Available Filters
- **All bookmarks**: No categoryId parameter
- **Specific category**: Use numeric categoryId
- **Uncategorized**: Use `categoryId=uncategorized`
- **Null/None**: Use `categoryId=null`

### Filter Examples
```bash
# All bookmarks
GET /api/bookmarks/export

# Category ID 5
GET /api/bookmarks/export?categoryId=5

# Uncategorized bookmarks
GET /api/bookmarks/export?categoryId=uncategorized

# Null category (same as uncategorized)
GET /api/bookmarks/export?categoryId=null
```

## Export Features

### Complete Data Export
- **All bookmark fields** included
- **Category information** preserved
- **Tag data** maintained
- **Timestamps** included
- **Metadata** preserved

### Selective Export
- **Filter by category** for targeted exports
- **Format selection** for different use cases
- **Custom queries** for specific needs
- **Batch processing** for large collections

### Data Integrity
- **Original structure** maintained
- **Relationships** preserved
- **Encoding** handled properly
- **Special characters** escaped correctly

## Use Cases

### Backup and Restore
- **Regular backups** of your bookmark collection
- **Disaster recovery** in case of data loss
- **Version control** of your bookmarks
- **Migration safety** before major changes

### Data Migration
- **Import to other systems** using JSON format
- **Spreadsheet analysis** using CSV format
- **Custom processing** with structured data
- **Integration** with other tools

### Sharing and Collaboration
- **Share collections** with colleagues
- **Export subsets** for specific projects
- **Format conversion** for different tools
- **Data analysis** in external applications

## Best Practices

### Regular Exports
- **Schedule regular backups** of your data
- **Export before major changes** or updates
- **Keep multiple export versions** for safety
- **Test restore process** periodically

### Data Organization
- **Use categories** to organize exports
- **Clean up data** before exporting
- **Remove duplicates** if necessary
- **Verify export completeness**

### Security Considerations
- **Protect exported files** with appropriate security
- **Be aware** of sensitive information in descriptions
- **Use secure storage** for backup files
- **Consider encryption** for sensitive exports

## Troubleshooting

### Export Issues
- **Check authentication** - must be logged in
- **Verify permissions** for category access
- **Large exports** may take time to process
- **Network issues** may cause timeouts

### Format Problems
- **CSV encoding** issues with special characters
- **JSON parsing** errors in some applications
- **Field mapping** problems in import tools
- **Date format** differences across systems

### Data Missing
- **Check category filters** are correct
- **Verify bookmark visibility** settings
- **Confirm export parameters** are valid
- **Review access permissions**

## Advanced Usage

### Custom Exports
- **API integration** for automated exports
- **Scheduled exports** using cron jobs
- **Custom filtering** with query parameters
- **Batch processing** for large collections

### Data Processing
- **Parse JSON** with programming languages
- **Import CSV** into databases
- **Transform data** for specific needs
- **Integrate** with other systems

The export functionality provides flexible and comprehensive ways to extract your bookmark data, ensuring you always have access to your information regardless of the platform or tool you're using.
