# ShortMail

A simple web application inspired by Dan Ariely's ShortWhale, built with FastAPI and HTMX. It allows users to send short messages (max 500 characters) to the owner.

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Run the application:
   ```
   uvicorn app.main:app --reload
   ```

3. Open your browser and navigate to `http://localhost:8000`

## Features

- Send short messages (max 500 characters)
- Simple and clean interface
- Real-time character count
