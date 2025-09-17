# Link Checking

Learn how Memorize Vault automatically checks the health of your bookmarks to identify broken or problematic links.

## How Link Checking Works

### **Automatic Checking**
1. **Scheduled Checks**: Links are checked periodically in the background
2. **New Bookmark Checks**: New bookmarks are checked when added
3. **Manual Checks**: Force check specific bookmarks on demand
4. **Bulk Checks**: Check multiple bookmarks at once
5. **Status Updates**: Bookmark status is updated based on check results

### **Check Process**
- **HTTP Request**: Sends request to bookmark URL
- **Response Analysis**: Analyzes HTTP response code and headers
- **Timeout Handling**: Manages requests that take too long
- **Error Detection**: Identifies various types of errors
- **Status Update**: Updates bookmark status accordingly

## Link Status Types

### **Working Links**
- **Green Indicator**: Link is accessible and functional
- **HTTP 200**: Successful response from server
- **Fast Response**: Quick loading time
- **No Errors**: Link functions properly

### **Broken Links**
- **Red Indicator**: Link is not accessible
- **HTTP 404**: Page not found error
- **HTTP 500**: Server error
- **Connection Error**: Cannot connect to server

### **Problematic Links**
- **Yellow Indicator**: Link has issues but may work
- **HTTP 301/302**: Redirect responses
- **Slow Response**: Takes too long to load
- **Partial Content**: Incomplete response

### **Unknown Status**
- **Gray Indicator**: Status not yet determined
- **Never Checked**: Link hasn't been verified
- **Check Pending**: Verification in progress
- **Check Failed**: Could not determine status

## Check Configuration

### **Check Settings**
- **Timeout Duration**: How long to wait for response (default: 10 seconds)
- **Retry Attempts**: Number of retry attempts for failed checks
- **Check Frequency**: How often to check links (daily, weekly, monthly)
- **Parallel Checks**: Number of simultaneous checks

### **Advanced Options**
- **Follow Redirects**: Whether to follow HTTP redirects
- **Check Headers**: Analyze response headers for additional info
- **Custom User Agent**: Use specific user agent string
- **Proxy Settings**: Configure proxy for checking

## Manual Link Checking

### **Single Bookmark Check**
1. **Open bookmark details** by clicking on it
2. **Click Check Link** button
3. **Wait for check** to complete
4. **Review results** and status update

### **Bulk Link Checking**
1. **Select multiple bookmarks** using checkboxes
2. **Click Check Links** in the toolbar
3. **Monitor progress** in the status bar
4. **Review results** when checking complete

## Check Results

### **Status Indicators**
- **Green Checkmark**: Link is working properly
- **Red X**: Link is broken or inaccessible
- **Yellow Warning**: Link has issues but may work
- **Gray Question**: Status unknown or check failed

### **Detailed Information**
- **Response Code**: HTTP status code returned
- **Response Time**: How long the request took
- **Last Checked**: When the link was last verified
- **Error Details**: Specific error information if available

## Managing Check Results

### **Working Links**
- **Verify Content**: Ensure the link still shows relevant content
- **Update Description**: Refresh bookmark information if needed
- **Add Tags**: Improve organization with relevant tags
- **Share Bookmark**: Make available to others if appropriate

### **Broken Links**
- **Fix URL**: Correct the web address if possible
- **Find Alternative**: Search for replacement content
- **Archive Bookmark**: Move to archive if no longer needed
- **Delete Bookmark**: Remove permanently if obsolete

## Check Scheduling

### **Automatic Scheduling**
- **Daily Checks**: Check all bookmarks once per day
- **Weekly Checks**: Check all bookmarks once per week
- **Monthly Checks**: Check all bookmarks once per month
- **Custom Schedule**: Set your own checking frequency

### **Priority Checking**
- **Favorites First**: Check favorited bookmarks more frequently
- **Recent Bookmarks**: Check newly added bookmarks immediately
- **Category-based**: Check bookmarks in specific categories
- **Status-based**: Check bookmarks with unknown status

## Best Practices

### **Check Strategy**
- **Regular Checking**: Verify links periodically to maintain quality
- **Priority Checking**: Check important bookmarks more frequently
- **Batch Checking**: Group similar checks together for efficiency
- **Monitor Results**: Review check results and take action

### **Maintenance Tips**
- **Fix Broken Links**: Correct URLs or find alternatives
- **Update Descriptions**: Keep bookmark information current
- **Remove Obsolete**: Delete bookmarks that are no longer relevant
- **Archive Old**: Move outdated bookmarks to archive

## Troubleshooting

### **Common Issues**
- **Check Not Starting**: Verify internet connection and server status
- **Slow Checking**: Reduce number of parallel checks
- **False Positives**: Verify links manually if they seem incorrect
- **Check Failing**: Check browser permissions and firewall settings

### **Performance Tips**
- **Limit Parallel Checks**: Don't check too many links simultaneously
- **Use Filters**: Narrow down bookmarks before checking
- **Schedule Checks**: Use automatic checking during off-peak hours
- **Clear Results**: Remove old check data if not needed

## Getting Help

If you have issues with link checking, check the Common Issues section or contact support.
