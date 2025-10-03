# Authentication in ShortMail

ShortMail uses **WorkOS AuthKit** for authentication, providing a secure, hosted authentication solution that handles user registration, login, and session management.

## Overview

The authentication system is built on top of WorkOS AuthKit, which provides:
- Hosted authentication pages
- OAuth 2.0 compliant authentication flow
- Session management
- User profile management

## Authentication Flow

### 1. Login Process

1. **User clicks login** → Redirected to `/login` endpoint
2. **Authorization URL generation** → WorkOS AuthKit authorization URL is created
3. **User authentication** → User is redirected to WorkOS hosted login page
4. **Callback handling** → After authentication, WorkOS redirects to `/callback`
5. **User creation/update** → User is created or updated in local database
6. **Session setup** → User email and access token stored in session
7. **Redirect** → User is redirected to intended destination or dashboard

### 2. Session Management

- **Session storage**: Uses FastAPI's `SessionMiddleware` with a secret key
- **Session data**: Stores `user_email` and `access_token`
- **Session validation**: Each request checks for `user_email` in session
- **Intended destination**: Stores the URL user was trying to access before login

### 3. Logout Process

1. **User clicks logout** → Redirected to `/logout` endpoint
2. **Session clearing** → All session data is cleared using `request.session.clear()`
3. **Redirect** → User is redirected to home page

## User Model

The `User` model in the database stores:

```python
class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    vanity_name = Column(String, unique=True, index=True)
    display_name = Column(String)
    is_paid = Column(Boolean, default=False)
    login_token = Column(String)  # Legacy field
    token_expiry = Column(DateTime)  # Legacy field
    is_admin = Column(Boolean, default=False)  # Deprecated
    admin_role = Column(String, default=None)  # Current: 'super_admin', 'admin', 'moderator'
```

## Role-Based Access Control

### Admin Roles Hierarchy

1. **super_admin** (Level 3): Full administrative access
2. **admin** (Level 2): Standard administrative access
3. **moderator** (Level 1): Limited administrative access

### Access Control Functions

- **`get_current_user()`**: Retrieves current user from session
- **`get_admin_user()`**: Gets admin user if authenticated and has admin role
- **`require_admin_role(role)`**: FastAPI dependency requiring specific admin role
- **`check_admin_access()`**: Checks admin access for admin pages

### Admin Page Protection

Admin pages use `check_admin_access()` which:
- Shows auth required page if not authenticated
- Redirects to dashboard if authenticated but not admin
- Returns admin user if properly authenticated with admin role

## Authentication Endpoints

### `/login`
- **Method**: GET
- **Purpose**: Initiates authentication flow
- **Action**: Redirects to WorkOS AuthKit authorization URL

### `/callback`
- **Method**: GET
- **Purpose**: Handles WorkOS authentication callback
- **Parameters**: `code` (authorization code from WorkOS)
- **Action**:
  - Authenticates with WorkOS
  - Creates/updates user in database
  - Sets up session
  - Redirects to intended destination or dashboard

### `/logout`
- **Method**: GET
- **Purpose**: Logs out current user
- **Action**: Clears session and redirects to home page

## Session Configuration

```python
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY"))
```

- **Secret key**: Required for session encryption
- **Session storage**: In-memory (development) or persistent (production)
- **Session data**: `user_email`, `access_token`, `intended_destination`

## WorkOS Integration

### Environment Variables Required

```bash
WORKOS_API_KEY=your_workos_api_key
WORKOS_CLIENT_ID=your_workos_client_id
WORKOS_REDIRECT_URI=http://localhost:7196/callback
SECRET_KEY=your_secret_key_for_sessions
```

### WorkOS Client Setup

```python
workos.api_key = os.getenv("WORKOS_API_KEY")
workos_client = workos.client.SyncClient(api_key=os.getenv("WORKOS_API_KEY"))
```

## User Creation and Updates

### New User Creation
- Generates unique vanity name
- Sets `is_paid=False` by default
- Creates display name from WorkOS user data
- Stores in local database

### Existing User Updates
- Updates vanity name if needed
- Preserves existing user data
- Updates session information

## Security Features

1. **Session-based authentication**: No tokens stored in client
2. **WorkOS hosted login**: Secure authentication handled by WorkOS
3. **Role-based access control**: Hierarchical admin permissions
4. **Intended destination tracking**: Seamless redirect after login
5. **Session encryption**: Uses secret key for session security

## Error Handling

- **Missing authorization code**: Redirects to login
- **Authentication failure**: Redirects to login
- **Invalid session**: Shows auth required page
- **Insufficient permissions**: Redirects to dashboard or shows 403 error

## Template Integration

The authentication state is available in templates:
- `user`: Current user object (if authenticated)
- `admin`: Admin user object (if admin)
- Navigation shows login/logout based on authentication state
- Admin links only visible to users with admin roles
