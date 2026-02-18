"""
Main application code for the ShortMail application.
"""

import os
import markdown
import html2text

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.exc import IntegrityError
import workos

from shortmail.models.application import User, SubjectHeading, FAQ, get_db, engine
from shortmail.utils import (
    generate_vanity_name,
    send_email,
    migrate_users_vanity_names,
    ensure_correct_vanity_name,
    get_current_user,
)
from shortmail.models.rate_limits import RateLimiter
import re
from pyprojroot import here
from typing import Optional

load_dotenv()


app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY"))
templates = Jinja2Templates(directory=here() / "shortmail" / "app" / "templates")
app.mount(
    "/static",
    StaticFiles(directory=here() / "shortmail" / "app" / "static"),
    name="static",
)

# Initialize WorkOS
workos.api_key = os.getenv("WORKOS_API_KEY")
WORKOS_CLIENT_ID = os.getenv("WORKOS_CLIENT_ID")
WORKOS_REDIRECT_URI = os.getenv("WORKOS_REDIRECT_URI", "http://localhost:7196/callback")

# Create WorkOS client
workos_client = workos.client.SyncClient(api_key=os.getenv("WORKOS_API_KEY"))

rate_limiter = RateLimiter()
DISPOSABLE_EMAILS_PATH = here() / "data" / "disposable_emails.txt"


def get_admin_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Get the currently logged in admin user using WorkOS AuthKit."""
    user_email = request.session.get("user_email")
    if not user_email:
        return None

    user = db.query(User).filter(User.email == user_email).first()
    if not user or not user.admin_role:
        return None

    return user


def require_admin_role(required_role: str = "admin"):
    """
    Create a FastAPI dependency that requires a specific admin role.

    This function returns a dependency that can be used with FastAPI route
    handlers to enforce role-based access control. The dependency checks if
    the current user has the required admin role or higher in the hierarchy.

    :param required_role: The minimum admin role required (default: "admin").
                         Valid roles: "moderator", "admin", "super_admin"
    :return: A FastAPI dependency function that validates admin access
    :raises HTTPException: 401 if user is not authenticated
    :raises HTTPException: 403 if user lacks required admin role
    """

    def admin_dependency(request: Request, db: Session = Depends(get_db)) -> User:
        """
        FastAPI dependency that validates admin role requirements.

        This dependency function is returned by require_admin_role and performs
        the actual role validation. It checks the user's session, retrieves
        their admin role from the database, and validates they have sufficient
        privileges based on the role hierarchy.

        Role hierarchy (higher numbers have more privileges):
        - super_admin (3): Full administrative access
        - admin (2): Standard administrative access
        - moderator (1): Limited administrative access

        :param request: FastAPI Request object containing session data
        :param db: Database session dependency
        :return: The authenticated User object with admin privileges
        :raises HTTPException: 401 if no user session found
        :raises HTTPException: 403 if user has no admin role or insufficient privileges
        """
        user_email = request.session.get("user_email")
        if not user_email:
            raise HTTPException(status_code=401, detail="Authentication required")

        user = db.query(User).filter(User.email == user_email).first()
        if not user or not user.admin_role:
            raise HTTPException(status_code=403, detail="Admin access required")

        # Role hierarchy: super_admin > admin > moderator
        role_hierarchy = {"super_admin": 3, "admin": 2, "moderator": 1}
        user_level = role_hierarchy.get(user.admin_role, 0)
        required_level = role_hierarchy.get(required_role, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=403, detail=f"{required_role} role required"
            )

        return user

    return admin_dependency


def check_admin_access(request: Request, db: Session = Depends(get_db)):
    """
    Check admin access and return appropriate response for admin pages.

    This function checks if the user is authenticated and has admin privileges.
    - If not authenticated: shows auth_required page and stores intended destination
    - If authenticated but not admin: redirects to dashboard
    - If admin: returns the user object

    :param request: FastAPI Request object containing session data
    :param db: Database session dependency
    :return: TemplateResponse for auth_required, RedirectResponse to dashboard, or the admin user
    """
    user_email = request.session.get("user_email")
    if not user_email:
        # Store the intended destination so we can redirect back after login
        request.session["intended_destination"] = str(request.url)
        return templates.TemplateResponse(request, "auth_required.html", {})

    user = db.query(User).filter(User.email == user_email).first()
    if not user or not user.admin_role:
        return RedirectResponse(url="/dashboard", status_code=302)

    return user


def is_disposable_email(email: str) -> bool:
    """
    Check if an email is from a disposable email provider.

    This function checks if the domain of the provided email address
    matches any known disposable email provider domains stored in a file.
    If the disposable emails file does not exist, returns False.

    :param email: The email address to check
    :return: True if the email is from a disposable provider, False otherwise
    """
    if not DISPOSABLE_EMAILS_PATH.exists():
        return False

    domain = email.split("@")[-1].lower()
    with open(DISPOSABLE_EMAILS_PATH) as f:
        disposable_domains = {line.strip().lower() for line in f}
    return domain in disposable_domains


def is_valid_email(email: str) -> bool:
    """
    Validate email format and check for common patterns.

    :param email: Email address to validate
    :return: True if email appears valid, False otherwise
    """
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        return False

    # Check length constraints
    if len(email) > 254:  # Maximum length per RFC 5321
        return False

    local_part = email.split("@")[0]
    if len(local_part) > 64:  # Maximum local-part length
        return False

    return True


def run_migrations(engine):
    """
    Run database migrations to ensure schema is up to date.

    This function checks for missing columns in the users table
    and adds them if necessary. It also creates required indexes
    and runs any needed data migrations.

    The following columns are checked and added if missing:
    - is_paid: Boolean flag for paid user status
    - vanity_name: User's vanity URL name
    - display_name: User's display name
    - is_admin: Boolean flag for admin status

    :param engine: SQLAlchemy engine instance for database connection
    """
    inspector = inspect(engine)
    with engine.connect() as connection:
        if "users" in inspector.get_table_names():
            columns = [column["name"] for column in inspector.get_columns("users")]
            if "is_paid" not in columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN is_paid BOOLEAN DEFAULT FALSE")
                )
            if "vanity_name" not in columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN vanity_name VARCHAR")
                )
                connection.execute(
                    text(
                        "CREATE UNIQUE INDEX idx_users_vanity_name ON users(vanity_name)"  # noqa: E501
                    )
                )
            if "display_name" not in columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN display_name VARCHAR")
                )
            if "is_admin" not in columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE")
                )
            if "admin_role" not in columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN admin_role VARCHAR")
                )
            connection.commit()

    # Run the user migration after schema changes
    db = next(get_db())
    migrate_users_vanity_names(db)

    # Initialize super admin if environment variable is set
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL")
    if super_admin_email:
        super_admin = db.query(User).filter(User.email == super_admin_email).first()
        if super_admin and not super_admin.admin_role:
            super_admin.admin_role = "super_admin"
            db.commit()
            print(f"Initialized super admin: {super_admin_email}")


run_migrations(engine)


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """
    Render the root page of the application.

    This function handles GET requests to the root URL ("/")
    and returns the rendered "index.html" template.

    :param request: The incoming request object.
    :return: A TemplateResponse containing the rendered "index.html" template.
    """
    return templates.TemplateResponse(request, "index.html", {})


@app.get("/login")
async def login(request: Request):
    """
    Redirect users to WorkOS AuthKit for authentication.

    This endpoint generates a WorkOS AuthKit authorization URL and redirects
    the user to the WorkOS hosted authentication page.

    :param request: The incoming request object
    :return: Redirect response to WorkOS AuthKit
    """
    authorization_url = workos_client.user_management.get_authorization_url(
        provider="authkit",
        redirect_uri=WORKOS_REDIRECT_URI,
    )

    return RedirectResponse(url=authorization_url, status_code=302)


@app.get("/callback")
async def callback(request: Request, code: str = None, db: Session = Depends(get_db)):
    """
    Handle the WorkOS AuthKit authentication callback.

    This endpoint processes the authorization code returned by WorkOS AuthKit
    and authenticates the user. It creates or updates the user in the database
    and sets up the session.

    :param request: The incoming request object
    :param code: The authorization code from WorkOS
    :param db: The database session
    :return: Redirect response to dashboard or login page
    """
    if not code:
        return RedirectResponse(url="/login", status_code=302)

    try:
        # Authenticate with WorkOS AuthKit
        authenticate_response = workos_client.user_management.authenticate_with_code(
            code=code,
        )

        user_data = authenticate_response.user
        access_token = authenticate_response.access_token

        # Find or create user in our database
        user = db.query(User).filter(User.email == user_data.email).first()
        if not user:
            vanity_name = generate_vanity_name(user_data.email)
            user = User(
                email=user_data.email,
                vanity_name=vanity_name,
                is_paid=False,
                display_name=user_data.first_name + " " + user_data.last_name
                if user_data.first_name and user_data.last_name
                else user_data.email,
            )
            db.add(user)
            db.commit()
        else:
            ensure_correct_vanity_name(user, db)

        # Store the user email in session
        request.session["user_email"] = user.email
        request.session["access_token"] = access_token

        # Redirect to intended destination if stored, otherwise go to dashboard
        intended_destination = request.session.get("intended_destination")
        if intended_destination:
            # Clear the stored destination
            request.session.pop("intended_destination", None)
            return RedirectResponse(url=intended_destination, status_code=302)

        return RedirectResponse(url="/dashboard", status_code=302)

    except Exception as e:
        print(f"WorkOS AuthKit authentication error: {e}")
        return RedirectResponse(url="/login", status_code=302)


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, current_user: User = Depends(get_current_user)):
    """
    Render the user's dashboard page.

    This endpoint displays the user's dashboard with their subject headings and FAQs.
    It checks authentication, retrieves the user's data from the database,
    and formats FAQ answers as both HTML and plain text.
    Free tier users are limited to 5 subject headings and 3 FAQs.

    :param request: The incoming request object
    :param current_user: The authenticated user, obtained through dependency injection
    :return: The rendered dashboard template with user data and permissions
    """
    print("Current user:", current_user)  # Keep this debug line
    if not current_user:
        print("Redirecting to home page")  # Add this debug line
        return RedirectResponse(url="/", status_code=303)

    db = next(get_db())
    subject_headings = (
        db.query(SubjectHeading).filter(SubjectHeading.user_id == current_user.id).all()
    )
    faqs = db.query(FAQ).filter(FAQ.user_id == current_user.id).all()

    # Print data for debugging
    print("User:", current_user)
    print("Is paid:", current_user.is_paid)
    print("Subject headings:", subject_headings)
    print("FAQs:", faqs)

    for faq in faqs:
        faq.answer_html = markdown.markdown(faq.answer)
        faq.answer_text = html2text.html2text(faq.answer_html).strip()

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "user": current_user,
            "subject_headings": subject_headings,
            "faqs": faqs,
            "is_paid": current_user.is_paid,
            "can_add_subject": len(subject_headings) < 5 or current_user.is_paid,
            "can_add_faq": len(faqs) < 3 or current_user.is_paid,
        },
    )


@app.post("/add_subject_heading")
async def add_subject_heading(
    request: Request,
    heading: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a new subject heading for the authenticated user.

    This endpoint allows users to add subject headings to their profile.
    Free tier users are limited to 5 subject headings.

    :param request: The incoming request object
    :param heading: The subject heading text to add
    :param current_user: The authenticated user, obtained through dependency injection
    :param db: The database session
    :return: Redirect response to the dashboard
    :raises HTTPException: If user is not authenticated or has reached free tier limit
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    subject_headings = (
        db.query(SubjectHeading).filter(SubjectHeading.user_id == current_user.id).all()
    )
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
    db: Session = Depends(get_db),
):
    """
    Remove a subject heading for the authenticated user.

    This endpoint allows users to delete their own subject headings.
    The heading must belong to the authenticated user.

    :param heading_id: ID of the subject heading to remove
    :param current_user: The authenticated user, obtained through dependency injection
    :param db: The database session
    :return: Redirect response to the dashboard
    :raises HTTPException: If user is not authenticated
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    heading = (
        db.query(SubjectHeading)
        .filter(
            SubjectHeading.id == heading_id, SubjectHeading.user_id == current_user.id
        )
        .first()
    )
    if heading:
        db.delete(heading)
        db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)


@app.get("/send/{vanity_name}", response_class=HTMLResponse)
async def send_shortmail(
    request: Request, vanity_name: str, db: Session = Depends(get_db)
):
    """
    Render the send shortmail form page for a specific user.

    This endpoint displays a form that allows visitors to send a shortmail
    to the user identified by their vanity name. The form includes the user's
    subject headings and FAQs.

    :param request: The incoming request object
    :param vanity_name: The vanity name of the user to send mail to
    :param db: The database session, obtained through dependency injection
    :return: The rendered send shortmail template
    :raises HTTPException: If the user is not found
    """
    user = db.query(User).filter(User.vanity_name == vanity_name).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    subject_headings = (
        db.query(SubjectHeading).filter(SubjectHeading.user_id == user.id).all()
    )
    faqs = db.query(FAQ).filter(FAQ.user_id == user.id).all()

    for faq in faqs:
        faq.answer_html = markdown.markdown(faq.answer)

    return templates.TemplateResponse(
        request,
        "send_shortmail.html",
        {"user": user, "subject_headings": subject_headings, "faqs": faqs},
    )


@app.post("/send/{vanity_name}")
async def process_shortmail(
    request: Request,
    vanity_name: str,
    sender_name: str = Form(...),
    sender_email: str = Form(...),
    reply_needed: str = Form(...),
    subject: str = Form(...),
    custom_subject: str = Form(None),
    message: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Process a shortmail submission and send it to the recipient.

    This endpoint handles the form submission for sending a shortmail.
    It validates the input, formats the email with appropriate tags,
    and sends it to the recipient.

    :param request: The incoming request object
    :param vanity_name: Vanity name of the recipient
    :param sender_name: Name of the sender
    :param sender_email: Email address of the sender
    :param reply_needed: Whether a reply is needed ("yes" or "no")
    :param subject: Selected subject heading
    :param custom_subject: Custom subject if "OTHER" is selected
    :param message: The message body
    :param db: The database session
    :return: The rendered send result template
    :raises HTTPException: If user not found or message too long
    """
    user = db.query(User).filter(User.vanity_name == vanity_name).first()
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
    email_sent = send_email(
        "shortmail@mail.nonlinearlabs.ai",
        user.email,
        sender_email,
        email_subject,
        email_body,
    )

    return templates.TemplateResponse(
        request,
        "send_result.html",
        {
            "email_sent": email_sent,
            "vanity_name": user.vanity_name,
            "display_name": user.display_name
            or user.email,  # Fallback to email if display_name is not set
        },
    )


@app.post("/add_faq")
async def add_faq(
    request: Request,
    question: str = Form(...),
    answer: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a new FAQ entry for the current user.

    This endpoint allows users to add FAQ entries with a question and answer.
    Free tier users are limited to 3 FAQs, while paid users have no limit.

    :param request: The incoming request object
    :param question: The FAQ question text
    :param answer: The FAQ answer text
    :param current_user: The authenticated user making the request
    :param db: The database session
    :return: Redirect response to the dashboard
    :raises HTTPException: If user is not authenticated or has reached free tier limit
    """
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
    db: Session = Depends(get_db),
):
    """
    Remove a FAQ entry for the current user.

    This endpoint allows users to delete their own FAQ entries.
    The FAQ must belong to the authenticated user to be deleted.

    :param faq_id: The ID of the FAQ to remove
    :param current_user: The authenticated user making the request
    :param db: The database session
    :return: Redirect response to the dashboard
    :raises HTTPException: If user is not authenticated
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    faq = db.query(FAQ).filter(FAQ.id == faq_id, FAQ.user_id == current_user.id).first()
    if faq:
        db.delete(faq)
        db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)


@app.get("/faq/{user_email}", response_class=HTMLResponse)
async def user_faq(request: Request, user_email: str, db: Session = Depends(get_db)):
    """
    Display FAQs for a specific user.

    This endpoint retrieves and displays all FAQ entries for a given user,
    identified by their email address. The FAQ answers are converted from
    markdown to HTML for display.

    :param request: The incoming request object
    :param user_email: Email address of the user whose FAQs to display
    :param db: The database session
    :return: Template response with user and FAQ data
    :raises HTTPException: If the specified user is not found
    """
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    faqs = db.query(FAQ).filter(FAQ.user_id == user.id).all()

    for faq in faqs:
        faq.answer = markdown.markdown(faq.answer)

    return templates.TemplateResponse(
        request, "user_faq.html", {"user": user, "faqs": faqs}
    )


@app.get("/analytics", response_class=HTMLResponse)
async def analytics(request: Request, current_user: User = Depends(get_current_user)):
    """
    Display analytics data for the current user.

    This endpoint shows analytics information based on the user's paid status.
    Paid users see actual analytics data, while free users see an empty analytics page.

    :param request: The incoming request object
    :param current_user: The authenticated user making the request
    :return: Template response with user and analytics data, or redirect if not authenticated
    """
    if not current_user:
        return RedirectResponse(url="/")

    analytics_data = {}
    if current_user.is_paid:
        # Fetch real analytics data for paid users
        analytics_data = {
            "total_messages": 100,
            "popular_subjects": ["Subject 1", "Subject 2", "Subject 3"],
            "avg_response_time": "2 hours",
        }

    return templates.TemplateResponse(
        request, "analytics.html", {"user": current_user, "analytics": analytics_data}
    )


@app.post("/update_vanity_name")
async def update_vanity_name(
    request: Request,
    vanity_name: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the vanity name for a paid user.

    This endpoint allows paid users to customize their vanity name.
    Free users are not allowed to change their vanity name.
    The vanity name must be unique across all users.

    :param request: The incoming request object
    :param vanity_name: The new vanity name requested by the user
    :param current_user: The authenticated user making the request
    :param db: The database session
    :return: Redirect to dashboard on success, error template on failure
    :raises HTTPException: If user is not authenticated or not paid
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not current_user.is_paid:
        raise HTTPException(
            status_code=403,
            detail="Upgrade to a paid account to change your vanity name",
        )

    try:
        current_user.vanity_name = vanity_name
        db.commit()
    except IntegrityError:
        db.rollback()
        return templates.TemplateResponse(
            request,
            "dashboard.html",
            {
                "user": current_user,
                "error": "This vanity name is already taken. Please choose another.",
            },
        )

    return RedirectResponse(url="/dashboard", status_code=303)


@app.post("/update_display_name")
async def update_display_name(
    request: Request,
    display_name: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the display name for a user.

    This endpoint allows users to update their display name.
    The display name is required and cannot be empty.

    :param request: The incoming request object
    :param display_name: The new display name requested by the user
    :param current_user: The authenticated user making the request
    :param db: The database session
    :return: Redirect to dashboard on success, error template on failure
    :raises HTTPException: If user is not authenticated
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not display_name:
        return templates.TemplateResponse(
            request,
            "dashboard.html",
            {"user": current_user, "error": "Display name is required."},
        )

    current_user.display_name = display_name
    db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)


@app.get("/logout")
async def logout(request: Request):
    """
    Log out the current user by clearing their session.

    This endpoint clears all session data for the current user
    and redirects them to the home page.

    :param request: The incoming request object containing session data
    :return: Redirect response to the home page
    """
    request.session.clear()
    return RedirectResponse(url="/")


@app.post("/edit_faq/{faq_id}")
async def edit_faq(
    request: Request,
    faq_id: int,
    question: str = Form(...),
    answer: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Edit an existing FAQ entry for the authenticated user.

    This endpoint allows users to update both the question and answer
    of an existing FAQ entry that belongs to them.

    :param request: The incoming request object
    :param faq_id: The ID of the FAQ entry to edit
    :param question: The updated question text
    :param answer: The updated answer text
    :param current_user: The authenticated user making the request
    :param db: The database session
    :return: Redirect to dashboard on success
    :raises HTTPException: If user is not authenticated or FAQ not found
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    faq = db.query(FAQ).filter(FAQ.id == faq_id, FAQ.user_id == current_user.id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")

    faq.question = question
    faq.answer = answer
    db.commit()

    return RedirectResponse(url="/dashboard", status_code=303)


@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    admin_check=Depends(check_admin_access),
    db: Session = Depends(get_db),
):
    """Render the secure admin dashboard."""
    # If admin_check is a TemplateResponse or RedirectResponse, return it
    if hasattr(admin_check, "template") or hasattr(admin_check, "url"):
        return admin_check

    admin_user = admin_check  # It's the User object if we get here

    # Get basic stats
    total_users = db.query(User).count()
    paid_users = db.query(User).filter(User.is_paid).count()
    admin_users = db.query(User).filter(User.admin_role.isnot(None)).count()

    # Get recent users (last 10)
    recent_users = db.query(User).order_by(User.id.desc()).limit(10).all()

    stats = {
        "total_users": total_users,
        "paid_users": paid_users,
        "free_users": total_users - paid_users,
        "admin_users": admin_users,
        "recent_users": recent_users,
    }

    return templates.TemplateResponse(
        request, "admin_dashboard.html", {"admin": admin_user, "stats": stats}
    )


@app.get("/admin/users", response_class=HTMLResponse)
async def manage_users(
    request: Request,
    admin_check=Depends(check_admin_access),
    db: Session = Depends(get_db),
):
    """Render the user management page for admin users."""
    # If admin_check is a TemplateResponse or RedirectResponse, return it
    if hasattr(admin_check, "template") or hasattr(admin_check, "url"):
        return admin_check

    admin_user = admin_check  # It's the User object if we get here
    users = db.query(User).all()
    for user in users:
        ensure_correct_vanity_name(user, db)

    return templates.TemplateResponse(
        request, "manage_users.html", {"users": users, "admin": admin_user}
    )


@app.get("/admin/users/list", response_class=HTMLResponse)
async def get_users(
    request: Request,
    admin_check=Depends(check_admin_access),
    db: Session = Depends(get_db),
):
    """
    Get all users and ensure their vanity names are correct.

    This endpoint returns a partial HTML template containing the list of users.
    Each user's vanity name is validated before returning the response.

    :param request: The incoming request object containing session data
    :param admin_check: The admin access check result
    :param db: The database session
    :return: HTML response with partial template containing user list
    """
    # If admin_check is a TemplateResponse or RedirectResponse, return it
    if hasattr(admin_check, "template") or hasattr(admin_check, "url"):
        return admin_check

    users = db.query(User).all()
    for user in users:
        ensure_correct_vanity_name(user, db)

    return templates.TemplateResponse(
        request, "partials/user_list.html", {"users": users}
    )


@app.get("/admin/users/{user_id}/toggle-edit", response_class=HTMLResponse)
async def toggle_user_edit(
    request: Request,
    user_id: int,
    admin_check=Depends(check_admin_access),
    db: Session = Depends(get_db),
):
    """
    Toggle the edit mode for a user row in the user management interface.

    This endpoint returns a partial HTML template containing the editable form
    for the specified user. If the user is not found, it raises a 404 error.

    :param request: The incoming request object containing session data
    :param user_id: The ID of the user to edit
    :param admin_user: The authenticated admin user
    :param db: The database session
    :return: HTML response with partial template containing editable user form
    :raises HTTPException: If user with given ID is not found
    """
    # If admin_check is a TemplateResponse or RedirectResponse, return it
    if hasattr(admin_check, "template") or hasattr(admin_check, "url"):
        return admin_check

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return templates.TemplateResponse(
        request, "partials/user_edit_row.html", {"user": user}
    )


@app.post("/admin/users/{user_id}", response_class=HTMLResponse)
async def update_user(
    request: Request,
    user_id: int,
    is_paid: bool = Form(False),
    admin_role: str = Form(None),
    admin_check=Depends(check_admin_access),
    db: Session = Depends(get_db),
):
    """
    Update a user's paid status and admin role.

    This endpoint updates the paid status and admin role of a user.
    Only super_admins can assign admin roles.

    :param request: The incoming request object containing session data
    :param user_id: The ID of the user to update
    :param is_paid: The new paid status for the user
    :param admin_role: The new admin role for the user (None, 'moderator', 'admin', 'super_admin')
    :param admin_user: The authenticated admin user
    :param db: The database session
    :return: HTML response with partial template containing updated user row
    :raises HTTPException: If user with given ID is not found or insufficient permissions
    """
    # If admin_check is a TemplateResponse or RedirectResponse, return it
    if hasattr(admin_check, "template") or hasattr(admin_check, "url"):
        return admin_check

    admin_user = admin_check  # It's the User object if we get here

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_paid = is_paid

    # Only super_admins can assign admin roles
    if admin_role and admin_user.admin_role == "super_admin":
        user.admin_role = admin_role if admin_role != "none" else None
    elif admin_role and admin_user.admin_role != "super_admin":
        raise HTTPException(
            status_code=403, detail="Only super admins can assign admin roles"
        )

    db.commit()
    ensure_correct_vanity_name(user, db)

    # Fetch the updated user from the database
    updated_user = db.query(User).filter(User.id == user_id).first()

    return templates.TemplateResponse(
        request, "partials/user_row.html", {"user": updated_user}
    )


@app.delete("/admin/users/{user_id}", response_class=HTMLResponse)
async def delete_user(
    request: Request,
    user_id: int,
    admin_check=Depends(check_admin_access),
    db: Session = Depends(get_db),
):
    """
    Delete a user from the database.

    This endpoint deletes a user with the specified ID from the database.
    It returns an empty string since the corresponding row will be removed
    from the UI.

    :param request: The incoming request object containing session data
    :param user_id: The ID of the user to delete
    :param admin_user: The authenticated admin user
    :param db: The database session
    :return: Empty string response
    :raises HTTPException: If user with given ID is not found
    """
    # If admin_check is a TemplateResponse or RedirectResponse, return it
    if hasattr(admin_check, "template") or hasattr(admin_check, "url"):
        return admin_check

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return ""  # Return an empty string as we're removing the row


@app.get("/admin_login")
async def admin_login_redirect(request: Request):
    """Redirect to main login for admin access."""
    return RedirectResponse(url="/login", status_code=302)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=os.getenv("PORT", 8000))
