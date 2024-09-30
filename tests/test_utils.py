"""Tests for the utils module."""
from sqlalchemy.orm import Session
from shortmail.models import User
from shortmail.utils import ensure_correct_vanity_name, generate_vanity_name

def test_ensure_correct_vanity_name(db: Session):
    # Create a paid user with a custom vanity name
    paid_user = User(email="paid@example.com", vanity_name="custom_name", is_paid=True)
    db.add(paid_user)

    # Create a non-paid user with a generated vanity name
    non_paid_user = User(email="non_paid@example.com", vanity_name=generate_vanity_name("non_paid@example.com"), is_paid=False)
    db.add(non_paid_user)

    # Create a non-paid user without a vanity name
    new_user = User(email="new@example.com", is_paid=False)
    db.add(new_user)

    db.commit()

    # Test that the function doesn't change a paid user's vanity name
    ensure_correct_vanity_name(paid_user, db)
    assert paid_user.vanity_name == "custom_name"

    # Test that the function doesn't change a non-paid user's correct vanity name
    original_vanity = non_paid_user.vanity_name
    ensure_correct_vanity_name(non_paid_user, db)
    assert non_paid_user.vanity_name == original_vanity

    # Test that the function sets a vanity name for a user without one
    ensure_correct_vanity_name(new_user, db)
    assert new_user.vanity_name == generate_vanity_name(new_user.email)

    # Test that the function changes an incorrect vanity name for a non-paid user
    non_paid_user.vanity_name = "incorrect_name"
    db.commit()
    ensure_correct_vanity_name(non_paid_user, db)
    assert non_paid_user.vanity_name == generate_vanity_name(non_paid_user.email)

def test_generate_vanity_name():
    # Test the generate_vanity_name function
    email = "test.user@example.com"
    vanity_name = generate_vanity_name(email)
    assert isinstance(vanity_name, str)
    assert len(vanity_name) > 0

# Add more tests for other utility functions as needed

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
