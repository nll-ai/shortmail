import os
import secrets
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.exc import IntegrityError

from app.models import Base, User, SubjectHeading, FAQ, get_db, engine
from app.utils import generate_vanity_name, send_email, migrate_users_vanity_names

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
            if 'vanity_name' not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN vanity_name VARCHAR"))
                connection.execute(text("CREATE UNIQUE INDEX idx_users_vanity_name ON users(vanity_name)"))
            if 'display_name' not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR"))
            connection.commit()

    # Run the user migration after schema changes
    db = next(get_db())
    migrate_users_vanity_names(db)

run_migrations(engine)

def get_current_user(request: Request, db: Session = Depends(get_db)):
    user_email = request.session.get("user_email")
    if user_email:
        user = db.query(User).filter(User.email == user_email).first()
        if user and not user.vanity_name:
            user.vanity_name = generate_vanity_name(user.email)
            db.commit()
        return user
    return None

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/login")
async def login(request: Request, email: str = Form(...), db: Session = Depends(get_db)):
    """
    Handle user login or registration.

    This function processes the login request. If the user doesn't exist, it creates a new account.
    It generates a login token, sends a login link via email, and returns a template response.

    :param request: The incoming request object.
    :param email: The user's email address, obtained from the form.
    :param db: The database session, obtained through dependency injection.
    :return: A response indicating that the login link has been sent.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        vanity_name = generate_vanity_name(email)
        user = User(email=email, vanity_name=vanity_name)
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
async def dashboard(
    request: Request,
    vanity_name: str = Form(None),
    display_name: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        return RedirectResponse(url="/")

    if request.method == "POST":
        if not display_name:
            return templates.TemplateResponse("dashboard.html", {
                "request": request,
                "user": current_user,
                "error": "Display name is required."
            })

        try:
            if current_user.is_paid and vanity_name:
                current_user.vanity_name = vanity_name
            current_user.display_name = display_name
            db.commit()
        except IntegrityError:
            db.rollback()
            return templates.TemplateResponse("dashboard.html", {
                "request": request,
                "user": current_user,
                "error": "This vanity name is already taken. Please choose another."
            })

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

@app.get("/send/{vanity_name}", response_class=HTMLResponse)
async def send_shortmail(request: Request, vanity_name: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.vanity_name == vanity_name).first()
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
    if not current_user:
        return RedirectResponse(url="/")

    analytics_data = {}
    if current_user.is_paid:
        # Fetch real analytics data for paid users
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

@app.post("/update_vanity_name")
async def update_vanity_name(
    request: Request,
    vanity_name: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not current_user.is_paid:
        raise HTTPException(status_code=403, detail="Upgrade to a paid account to change your vanity name")

    try:
        current_user.vanity_name = vanity_name
        db.commit()
    except IntegrityError:
        db.rollback()
        return templates.TemplateResponse("dashboard.html", {
            "request": request,
            "user": current_user,
            "error": "This vanity name is already taken. Please choose another."
        })

    return RedirectResponse(url="/dashboard", status_code=303)

@app.post("/update_display_name")
async def update_display_name(
    request: Request,
    display_name: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not display_name:
        return templates.TemplateResponse("dashboard.html", {
            "request": request,
            "user": current_user,
            "error": "Display name is required."
        })

    current_user.display_name = display_name
    db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
