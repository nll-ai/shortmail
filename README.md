# ShortMail

A simple web application inspired by Dan Ariely's ShortWhale,
built with FastAPI and HTMX.
It allows users to send short messages (max 500 characters) to the owner.

## Setup

Install pixi if you haven't already:

```bash
curl -fsSL https://pixi.sh/install.sh | bash
```

Initialize the project environment:

```bash
pixi install
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# WorkOS AuthKit Configuration (required for authentication)
WORKOS_API_KEY=your_workos_api_key_here
WORKOS_CLIENT_ID=your_workos_client_id_here
WORKOS_REDIRECT_URI=http://localhost:7196/callback

# Admin Configuration
SUPER_ADMIN_EMAIL=your_admin_email@example.com

# Existing environment variables
SECRET_KEY=your_secret_key_here
RESEND_API_KEY=your_resend_api_key_here
PORT=8000
```

### WorkOS AuthKit Setup

1. Sign up for a WorkOS account at [workos.com](https://workos.com)
2. Create a new project in the WorkOS dashboard
3. Activate AuthKit in your WorkOS Dashboard by clicking "Set up User Management" in the Overview section
4. Get your API key and Client ID from the dashboard
5. Configure the redirect URI in WorkOS dashboard: `http://localhost:7196/callback`
6. Configure the login endpoint in WorkOS dashboard: `http://localhost:7196/login`

Run the application:

```bash
pixi run app
```

Open your browser and navigate to `http://localhost:7196`

## Features

- Secure user authentication with SSO support using WorkOS AuthKit
- Role-based admin access with WorkOS integration
- Send short messages (max 500 characters)
- Simple and clean interface
- Real-time character count
- User dashboard with subject headings and FAQs
- Admin panel for user management with role-based permissions
- Support for organization-based SSO login
