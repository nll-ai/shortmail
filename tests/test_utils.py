"""Tests for the utils module."""
from sqlalchemy.orm import Session
from shortmail.models import User
from shortmail.utils import ensure_correct_vanity_name, generate_vanity_name

def test_ensure_correct_vanity_name(db_session: Session):
    """
    Test the ensure_correct_vanity_name function.

    This test covers the following scenarios:
    1. Unpaid user with incorrect vanity name
    2. Unpaid user with correct vanity name
    3. Paid user with custom vanity name

    :param db_session: The database session to use for the test.
    """
    # Create test users with unique vanity names
    unpaid_user_incorrect = User(email="unpaid1@example.com", is_paid=False, vanity_name=generate_vanity_name("unpaid1@example.com"))
    unpaid_user_correct = User(email="unpaid2@example.com", is_paid=False, vanity_name=generate_vanity_name("unpaid2@example.com"))
    paid_user = User(email="paid@example.com", is_paid=True, vanity_name="custom2")

    db_session.add_all([unpaid_user_incorrect, unpaid_user_correct, paid_user])
    db_session.commit()

    # Test unpaid user with incorrect vanity name
    ensure_correct_vanity_name(unpaid_user_incorrect, db_session)
    assert unpaid_user_incorrect.vanity_name == generate_vanity_name("unpaid1@example.com")

    # Test unpaid user with correct vanity name
    original_vanity = unpaid_user_correct.vanity_name
    ensure_correct_vanity_name(unpaid_user_correct, db_session)
    assert unpaid_user_correct.vanity_name == original_vanity

    # Test paid user with custom vanity name
    ensure_correct_vanity_name(paid_user, db_session)
    assert paid_user.vanity_name == "custom2"

    # Clean up
    db_session.delete(unpaid_user_incorrect)
    db_session.delete(unpaid_user_correct)
    db_session.delete(paid_user)
    db_session.commit()

import pytest
from unittest.mock import patch, MagicMock
from shortmail.utils import send_email

@pytest.fixture
def mock_smtp():
    with patch('shortmail.utils.smtplib.SMTP') as mock_smtp:
        yield mock_smtp

def test_send_email_success(mock_smtp):
    # Arrange
    from_email = "sender@example.com"
    to_email = "recipient@example.com"
    reply_to_email = "reply@example.com"
    subject = "Test Subject"
    body = "Test Body"

    # Act
    result = send_email(from_email, to_email, reply_to_email, subject, body)

    # Assert
    assert result is True
    mock_smtp.return_value.__enter__.return_value.send_message.assert_called_once()

def test_send_email_failure(mock_smtp):
    # Arrange
    from_email = "sender@example.com"
    to_email = "recipient@example.com"
    reply_to_email = "reply@example.com"
    subject = "Test Subject"
    body = "Test Body"

    mock_smtp.return_value.__enter__.return_value.send_message.side_effect = Exception("SMTP error")

    # Act
    result = send_email(from_email, to_email, reply_to_email, subject, body)

    # Assert
    assert result is False

def test_send_email_content(mock_smtp):
    # Arrange
    from_email = "sender@example.com"
    to_email = "recipient@example.com"
    reply_to_email = "reply@example.com"
    subject = "Test Subject"
    body = "Test Body with **markdown**"

    # Act
    send_email(from_email, to_email, reply_to_email, subject, body)

    # Assert
    called_with = mock_smtp.return_value.__enter__.return_value.send_message.call_args[0][0]
    assert called_with['From'] == from_email
    assert called_with['To'] == to_email
    assert called_with['Subject'] == subject
    assert called_with['Reply-To'] == reply_to_email
    assert "Test Body with **markdown**" in str(called_with.get_payload()[0])
    assert "<p>Test Body with <strong>markdown</strong></p>" in str(called_with.get_payload()[1])

@patch('shortmail.utils.MAIL_HOST', 'test_host')
@patch('shortmail.utils.MAIL_PORT', 587)
@patch('shortmail.utils.MAIL_USERNAME', 'test_user')
@patch('shortmail.utils.MAIL_PASSWORD', 'test_pass')
def test_send_email_smtp_config(mock_smtp):
    # Arrange
    from_email = "sender@example.com"
    to_email = "recipient@example.com"
    reply_to_email = "reply@example.com"
    subject = "Test Subject"
    body = "Test Body"

    # Act
    send_email(from_email, to_email, reply_to_email, subject, body)

    # Assert
    mock_smtp.assert_called_once_with('test_host', 587)
    mock_smtp.return_value.__enter__.return_value.starttls.assert_called_once()
    mock_smtp.return_value.__enter__.return_value.login.assert_called_once_with('test_user', 'test_pass')
