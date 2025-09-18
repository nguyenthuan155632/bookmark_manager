# Authentication

Memorize Vault uses a secure authentication system to protect your bookmark data and ensure only you can access your collection.

## Creating an Account

### Sign Up Process

1. **Navigate to the Auth Page**: Click "Sign In" or visit `/auth` if not already logged in
2. **Switch to Register Mode**: Click "Create Account" to switch from sign-in to registration
3. **Enter Username**: Choose a unique username (minimum 3 characters)
4. **Set Password**: Create a strong password (minimum 4 characters)
5. **Submit Registration**: Click "Create Account" to complete registration

### Username Requirements

- **Minimum Length**: 3 characters
- **Uniqueness**: Must be unique across all users
- **Characters**: Letters, numbers, and common symbols allowed
- **Case Sensitive**: Usernames are case-sensitive

### Password Requirements

- **Minimum Length**: 4 characters
- **Security**: Use a mix of letters, numbers, and symbols for better security
- **Storage**: Passwords are securely hashed and never stored in plain text

## Signing In

### Login Process

1. **Enter Username**: Type your registered username
2. **Enter Password**: Enter your account password
3. **Submit**: Click "Sign In" to authenticate
4. **Auto-Redirect**: You'll be redirected to your bookmark collection

### Remember Username

- **Automatic Storage**: Your username is remembered for convenience
- **Local Storage**: Stored securely in your browser
- **Skip Username Input**: If remembered, you can go straight to password entry

## Session Management

### Session Timeout

- **Default Duration**: 30 minutes of inactivity
- **Customizable**: Change timeout in Settings > Advanced
- **Rolling Sessions**: Activity refreshes the session timer
- **Automatic Logout**: You'll be logged out after the timeout period

### Session Security

- **Secure Cookies**: Sessions use secure, HTTP-only cookies
- **Server-Side Storage**: Session data stored securely on the server
- **Automatic Cleanup**: Expired sessions are automatically removed

## Password Management

### Changing Your Password

1. **Go to Settings**: Navigate to Settings > Account
2. **Enter Current Password**: Provide your current password
3. **Enter New Password**: Choose a new password (min 4 characters)
4. **Confirm New Password**: Re-type the new password
5. **Update**: Click "Update Password" to save changes

### Password Security

- **Hashed Storage**: Passwords are never stored in plain text
- **Strong Hashing**: Uses bcrypt for secure password hashing
- **Verification**: Current password required for changes
- **Confirmation**: New password must be entered twice

## Account Security

### Protected Bookmarks

- **Passcode Protection**: Individual bookmarks can be protected with passcodes
- **Account Password**: Your account password can unlock protected bookmarks
- **Dual Access**: Use either the bookmark passcode or your account password
- **Secure Storage**: Passcodes are hashed and stored securely

### Data Privacy

- **User Isolation**: Each user's data is completely separate
- **No Cross-User Access**: Users cannot access each other's bookmarks
- **Secure Queries**: All database queries are user-scoped
- **Private by Default**: All bookmarks are private unless explicitly shared

## Troubleshooting Authentication

### Common Issues

**Forgot Password**

- Contact support at nt.apple.it@gmail.com for password reset assistance

**Username Not Remembered**

- Clear browser data and try again
- Check if cookies are enabled

**Session Expired**

- Simply sign in again
- Consider increasing session timeout in settings

**Login Fails**

- Verify username and password are correct
- Check for typos in username (case-sensitive)
- Ensure caps lock is not enabled

### Security Best Practices

1. **Use Strong Passwords**: Mix letters, numbers, and symbols
2. **Don't Share Credentials**: Keep your login information private
3. **Log Out When Done**: Especially on shared computers
4. **Regular Updates**: Change passwords periodically
5. **Secure Devices**: Only log in from trusted devices

## Getting Help

If you encounter any authentication issues:

1. **Check Documentation**: Review this guide for common solutions
2. **Contact Support**: Email nt.apple.it@gmail.com for assistance
3. **Report Issues**: Include details about the problem you're experiencing

Your account security is our priority, and we're here to help ensure you can access your bookmarks safely and securely.
