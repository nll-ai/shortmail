import os
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import markdown

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, relationship, sessionmaker  # Add relationship here
from sqlalchemy.sql import func
from starlette.middleware.sessions import SessionMiddleware

load_dotenv()

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY"))
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

def run_migrations(engine):
    inspector = inspect(engine)
    with engine.connect() as connection:
        if 'users' in inspector.get_table_names():
            columns = [column['name'] for column in inspector.get_columns('users')]
            if 'is_paid' not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN is_paid BOOLEAN DEFAULT FALSE"))
                connection.commit()

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./shortmail.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
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
    is_paid = Column(Boolean, default=False)
    subject_headings = relationship("SubjectHeading", back_populates="user")
    faqs = relationship("FAQ", back_populates="user")

class SubjectHeading(Base):
    __tablename__ = "subject_headings"
    id = Column(Integer, primary_key=True, index=True)
    heading = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))

SubjectHeading.user = relationship("User", back_populates="subject_headings")

class FAQ(Base):
    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))

FAQ.user = relationship("User", back_populates="faqs")

Base.metadata.create_all(bind=engine)
# Remove or comment out this line if it exists
# run_migrations(engine)

# Email configuration
MAIL_HOST = os.getenv('MAIL_HOST')
MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
MAIL_USERNAME = os.getenv('MAIL_USERNAME')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')

def send_email(from_email, to_email, subject, body):
    msg = MIMEMultipart('alternative')
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject

    # Create plain text version of the message
    text_part = MIMEText(body, 'plain')
    msg.attach(text_part)

    # Create HTML version of the message
    html_body = markdown.markdown(body)
    html_part = MIMEText(html_body, 'html')
    msg.attach(html_part)

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

    subject_headings = db.query(SubjectHeading).filter(SubjectHeading.user_id == current_user.id).all()
    faqs = db.query(FAQ).filter(FAQ.user_id == current_user.id).all()

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": current_user,
        "subject_headings": subject_headings,
        "faqs": faqs,
        "is_paid": current_user.is_paid,
        "can_add_subject": len(subject_headings) < 5 or current_user.is_paid,
        "can_add_faq": len(faqs) < 3 or current_user.is_paid
    })

@app.post("/add_subject_heading")
async def add_subject_heading(
    request: Request,
    heading: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    subject_headings = db.query(SubjectHeading).filter(SubjectHeading.user_id == current_user.id).all()
    if len(subject_headings) >= 5 and not current_user.is_paid:
        raise HTTPException(status_code=403, detail="Free tier limit reached")

    new_heading = SubjectHeading(heading=heading, user_id=current_user.id)
    db.add(new_heading)
    db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)

@app.post("/remove_subject_heading/{heading_id}")
async def remove_subject_heading(
    heading_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    heading = db.query(SubjectHeading).filter(SubjectHeading.id == heading_id, SubjectHeading.user_id == current_user.id).first()
    if heading:
        db.delete(heading)
        db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)

@app.post("/send/{user_email}")
async def process_shortmail(
    request: Request,
    user_email: str,
    sender_name: str = Form(...),
    sender_email: str = Form(...),
    reply_needed: str = Form(...),
    subject: str = Form(...),
    custom_subject: str = Form(None),
    message: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Message exceeds 500 characters")

    # Use custom subject if "OTHER" is selected
    email_subject = custom_subject if subject == "OTHER" else subject

    # Prepend reply needed tag to the subject
    reply_tag = "[RN]" if reply_needed == "yes" else "[NRN]"
    email_subject = f"{reply_tag} {email_subject}"

    # Compose the email body
    email_body = f"From: {sender_name} <{sender_email}>\n\n{message}"

    # Send email
    email_sent = send_email(sender_email, user.email, email_subject, email_body)

    return templates.TemplateResponse("send_result.html", {
        "request": request,
        "email_sent": email_sent,
        "recipient_email": user_email
    })

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/")

@app.get("/send/{user_email}", response_class=HTMLResponse)
async def send_shortmail(request: Request, user_email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    subject_headings = db.query(SubjectHeading).filter(SubjectHeading.user_id == user.id).all()
    faqs = db.query(FAQ).filter(FAQ.user_id == user.id).all()

    return templates.TemplateResponse("send_shortmail.html", {
        "request": request,
        "user": user,
        "subject_headings": subject_headings,
        "faqs": faqs
    })

@app.post("/add_faq")
async def add_faq(
    request: Request,
    question: str = Form(...),
    answer: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    faqs = db.query(FAQ).filter(FAQ.user_id == current_user.id).all()
    if len(faqs) >= 3 and not current_user.is_paid:
        raise HTTPException(status_code=403, detail="Free tier limit reached")

    new_faq = FAQ(question=question, answer=answer, user_id=current_user.id)
    db.add(new_faq)
    db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)

@app.post("/remove_faq/{faq_id}")
async def remove_faq(
    faq_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    faq = db.query(FAQ).filter(FAQ.id == faq_id, FAQ.user_id == current_user.id).first()
    if faq:
        db.delete(faq)
        db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)

@app.get("/faq/{user_email}", response_class=HTMLResponse)
async def user_faq(request: Request, user_email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    faqs = db.query(FAQ).filter(FAQ.user_id == user.id).all()

    return templates.TemplateResponse("user_faq.html", {
        "request": request,
        "user": user,
        "faqs": faqs
    })

@app.get("/analytics", response_class=HTMLResponse)
async def analytics(request: Request, current_user: User = Depends(get_current_user)):
    if not current_user or not current_user.is_paid:
        raise HTTPException(status_code=403, detail="Paid tier feature")

    # Here you would typically fetch analytics data
    # For now, we'll just pass some dummy data
    analytics_data = {
        "total_messages": 100,
        "popular_subjects": ["Subject 1", "Subject 2", "Subject 3"],
        "avg_response_time": "2 hours"
    }

    return templates.TemplateResponse("analytics.html", {
        "request": request,
        "user": current_user,
        "analytics": analytics_data
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
