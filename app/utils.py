import hashlib
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import markdown
import os

# Email configuration
MAIL_HOST = os.getenv('MAIL_HOST')
MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
MAIL_USERNAME = os.getenv('MAIL_USERNAME')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')

def generate_vanity_name(email):
    # Create SHA256 hash of the email
    hash_object = hashlib.sha256(email.encode())
    hash_digest = hash_object.hexdigest()

    # Return the first 6 characters of the hash
    return hash_digest[:6]

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

def migrate_users_vanity_names(db):
    from app.models import User  # Import here to avoid circular imports
    users_without_vanity = db.query(User).filter(User.vanity_name == None).all()
    for user in users_without_vanity:
        user.vanity_name = generate_vanity_name(user.email)
    db.commit()
