"""
Utility functions for the ShortMail application.
"""

import hashlib
import os
from loguru import logger

import resend
import markdown
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from fastapi import Depends, Request

from shortmail.models.application import User, get_db

load_dotenv()

# Email configuration
resend.api_key = (
    "re_XskzuAKx_F8TkuVjf22wo1dVk7TqykdiG"  # Replace with your actual API key
)


def generate_vanity_name(email: str) -> str:
    """
    Generate a vanity name based on the user's email.

    This function creates a SHA256 hash of the email
    and returns the first 6 characters of the hash.

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
    Send an email using Resend.

    :param from_email: The sender's email address.
    :param to_email: The recipient's email address.
    :param reply_to_email: The email address for replies.
    :param subject: The subject of the email.
    :param body: The body of the email in plain text.
    :return: True if the email was sent successfully, False otherwise.
    """
    try:
        logger.info(f"Sending email to {to_email} with subject: {subject}")

        # Convert plain text body to HTML using markdown
        html_body = markdown.markdown(body)

        params: resend.Emails.SendParams = {
            "from": from_email,
            "to": [to_email],  # to should be a list
            "reply_to": reply_to_email,
            "subject": subject,
            "html": html_body,
            "text": body,
        }

        email: resend.Email = resend.Emails.send(params)

        logger.info(
            f"Email sent successfully to {to_email}. Email information: {email}"
        )
        return True
    except Exception as e:
        logger.error(f"Error sending email with Resend: {type(e).__name__}: {e}")
        return False


def migrate_users_vanity_names(db: Session) -> None:
    """
    Migrate users' vanity names.

    This function assigns a vanity name to users who do not have one yet.
    The vanity name is generated based on the user's email.

    :param db: The database session.
    """
    from shortmail.models.application import (
        User,
    )  # Import here to avoid circular imports

    users_without_vanity = db.query(User).filter(User.vanity_name is None).all()
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
    return db.query(User).filter(User.is_admin is True).first() is not None


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
    # If the user is paid, we don't change their vanity name


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Retrieve the current user based on the session information.

    This function checks the session for a user email,
    queries the database for the corresponding user,
    and ensures the user's vanity name is correct.

    :param request: The incoming request object containing session data.
    :param db: The database session, obtained through dependency injection.
    :return: The User object if found and authenticated, None otherwise.
    """
    user_email = request.session.get("user_email")
    if user_email:
        user = db.query(User).filter(User.email == user_email).first()
        if user:
            ensure_correct_vanity_name(user, db)
        return user
    return None
