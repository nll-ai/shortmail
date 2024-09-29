"""
Utility functions for the ShortMail application.
"""

import hashlib
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from loguru import logger

import markdown
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from shortmail.models import User  # Make sure this import is at the top of the file

load_dotenv()

# Email configuration
MAIL_HOST = os.getenv("MAIL_HOST")
MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")


def generate_vanity_name(email: str) -> str:
    """
    Generate a vanity name based on the user's email.

    This function creates a SHA256 hash of the email and returns the first 6 characters of the hash.

    :param email: The user's email address.
    :return: A 6-character string derived from the SHA256 hash of the email.
    """
    # Create SHA256 hash of the email
    hash_object = hashlib.sha256(email.encode())
    hash_digest = hash_object.hexdigest()

    # Return the first 12 characters of the hash
    return hash_digest[:12]


def send_email(
    from_email: str, to_email: str, reply_to_email: str, subject: str, body: str
) -> bool:
    """
    Send an email with both plain text and HTML content.

    :param from_email: The sender's email address.
    :param to_email: The recipient's email address.
    :param reply_to_email: The email address for replies.
    :param subject: The subject of the email.
    :param body: The body of the email in plain text.
    :return: True if the email was sent successfully, False otherwise.
    """
    msg = MIMEMultipart("alternative")
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    # Add Reply-To header
    msg["Reply-To"] = reply_to_email

    # Create plain text version of the message
    text_part = MIMEText(body, "plain")
    msg.attach(text_part)

    # Create HTML version of the message
    html_body = markdown.markdown(body)
    html_part = MIMEText(html_body, "html")
    msg.attach(html_part)

    try:
        logger.info(f"Sending email to {to_email} with subject: {subject}")
        with smtplib.SMTP(MAIL_HOST, MAIL_PORT) as server:
            logger.info(f"Connecting to SMTP server at {MAIL_HOST}:{MAIL_PORT}")
            server.starttls()
            logger.info(f"Logging in to SMTP server as {MAIL_USERNAME}")
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return False


def migrate_users_vanity_names(db: Session) -> None:
    """
    Migrate users' vanity names.

    This function assigns a vanity name to users who do not have one yet.
    The vanity name is generated based on the user's email.

    :param db: The database session.
    """
    from shortmail.models import User  # Import here to avoid circular imports

    users_without_vanity = db.query(User).filter(User.vanity_name == None).all()
    for user in users_without_vanity:
        user.vanity_name = generate_vanity_name(user.email)
    db.commit()


def admin_exists(db: Session) -> bool:
    """
    Check if an admin user exists in the database.

    This function queries the database to determine if there
    is at least one user with admin privileges.

    :param db: The database session.
    :return: True if an admin user exists, False otherwise.
    """
    return db.query(User).filter(User.is_admin == True).first() is not None

def set_user_paid_status(db: Session, user_id: int, paid_status: bool) -> bool:
    """
    Set the paid status for a user.

    This function updates the paid status of a user in the database.
    If the user is not found, it returns False.

    :param db: The database session.
    :param user_id: The ID of the user to update.
    :param paid_status: The new paid status to set for the user.
    :return: True if the update was successful, False otherwise.
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        user.is_paid = paid_status
        db.commit()
        return True
    except Exception as e:
        print(f"Error updating user paid status: {e}")
        return False

def ensure_correct_vanity_name(user: User, db: Session) -> None:
    """
    Ensure the user has the correct vanity name based on their paid status.

    :param user: The User object to check and potentially update
    :param db: The database session
    """
    if not user.is_paid:
        generated_vanity_name = generate_vanity_name(user.email)
        if user.vanity_name != generated_vanity_name:
            user.vanity_name = generated_vanity_name
            db.commit()
