from fastapi import FastAPI, Request, Form, HTTPException, Depends
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv
import secrets
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.sql import func
from sqlalchemy.orm import Session

load_dotenv()

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY"))
templates = Jinja2Templates(directory="app/templates")

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./shortmail.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def run_migrations(engine):
    inspector = inspect(engine)
    if 'messages' in inspector.get_table_names():
        columns = [column['name'] for column in inspector.get_columns('messages')]
        if 'user_id' not in columns:
            with engine.connect() as connection:
                connection.execute(text("ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id)"))
                # Update existing messages with a default user_id if necessary
                connection.execute(text("UPDATE messages SET user_id = (SELECT id FROM users LIMIT 1) WHERE user_id IS NULL"))
                connection.commit()

run_migrations(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    login_token = Column(String, unique=True, index=True)
    token_expiry = Column(DateTime)

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))

Base.metadata.create_all(bind=engine)
run_migrations(engine)

# Email configuration
MAIL_HOST = os.getenv('MAIL_HOST')
MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
MAIL_USERNAME = os.getenv('MAIL_USERNAME')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')

def send_email(from_email,to_email, subject, body):
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP(MAIL_HOST, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(request: Request, db: Session = Depends(get_db)):
    user_email = request.session.get("user_email")
    if user_email:
        return db.query(User).filter(User.email == user_email).first()
    return None

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/login")
async def login(request: Request, email: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email)
        db.add(user)
        db.commit()

    token = secrets.token_urlsafe(32)
    user.login_token = token
    user.token_expiry = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    login_url = f"{request.base_url}login/{token}"
    send_email("login@shortmail.com", email, "ShortMail Login Link", f"Click here to log in: {login_url}")

    return templates.TemplateResponse("login_sent.html", {"request": request})

@app.get("/login/{token}")
async def verify_login(request: Request, token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.login_token == token, User.token_expiry > datetime.utcnow()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.login_token = None
    user.token_expiry = None
    db.commit()

    request.session["user_email"] = user.email
    return RedirectResponse(url="/dashboard")

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        return RedirectResponse(url="/")

    # Fetch the user's messages, ordered by creation time (most recent first)
    messages = db.query(Message).filter(Message.user_id == current_user.id).order_by(Message.created_at.desc()).limit(10).all()

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": current_user,
        "messages": messages
    })

@app.post("/send", response_class=HTMLResponse)
async def send_message(
    request: Request,
    message: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Message exceeds 500 characters")

    new_message = Message(content=message, user_id=current_user.id)
    db.add(new_message)
    db.commit()

    # Send email (you can customize this part)
    email_sent = send_email(MAIL_USERNAME, f"New ShortMail from {current_user.email}", message)

    return templates.TemplateResponse("result.html", {
        "request": request,
        "email_sent": email_sent
    })

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
