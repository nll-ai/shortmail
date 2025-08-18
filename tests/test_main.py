"""Tests for the main application."""

import pytest
from fastapi.testclient import TestClient
from shortmail.app.main import app, get_current_user
from shortmail.models import User, SubjectHeading, FAQ
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from datetime import timezone
from sqlalchemy import inspect

client = TestClient(app)


def test_dashboard_authenticated():
    """Test the dashboard endpoint for authenticated users."""
    # Create a mock user
    mock_user = User(
        id=1,
        email="test@example.com",
        vanity_name="test_user",
        display_name="Test User",
        is_paid=False,
    )

    # Override the get_current_user dependency
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Mock the database session
    with patch("shortmail.app.main.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_get_db.return_value.__next__.return_value = mock_db

        # Mock the database queries
        mock_subject_headings = [
            SubjectHeading(id=1, heading="Test Subject", user_id=1)
        ]
        mock_faqs = [
            FAQ(id=1, question="Test Question", answer="Test Answer", user_id=1)
        ]

        mock_db.query.return_value.filter.return_value.all = MagicMock(
            side_effect=[mock_subject_headings, mock_faqs]
        )

        # Print mocked data for debugging
        print("Mocked subject headings:", mock_subject_headings)
        print("Mocked FAQs:", mock_faqs)

        # Make the request to the dashboard
        response = client.get("/dashboard")

        # Print out the response content for debugging
        print("Response content:", response.text)
        print("Response status code:", response.status_code)

        # Check the response
        assert response.status_code == 200
        assert "Test User" in response.text
        assert "Test Subject" in response.text
        assert "Test Question" in response.text
        assert "Test Answer" in response.text
        assert (
            "Upgrade to a paid account to change your vanity name" in response.text
        )  # Check for upgrade message

    # Remove the dependency override after the test
    app.dependency_overrides.clear()

    print("Test completed successfully")


def test_dashboard_unauthenticated():
    """Test the dashboard endpoint for unauthenticated users."""
    # Override the get_current_user dependency to return None (unauthenticated)
    app.dependency_overrides[get_current_user] = lambda: None

    response = client.get("/dashboard", follow_redirects=False)

    # Check if the response is a redirect to the home page
    assert response.status_code == 303
    assert response.headers["location"] == "/"

    # Remove the dependency override after the test
    app.dependency_overrides.clear()


@pytest.mark.usefixtures("client")
def test_verify_login(client: TestClient, db: Session):
    """Test the login endpoint."""
    # Debug: Print table names before adding the user
    inspector = inspect(db.bind)
    table_names = inspector.get_table_names()
    print(f"Tables before adding user: {table_names}")

    # Create a test user with a valid login token
    test_user = User(
        email="test@example.com",
        login_token="valid_token",
        token_expiry=datetime.now(tz=timezone.utc) + timedelta(hours=1),
    )
    db.add(test_user)
    db.commit()

    # Debug: Print table names after adding the user
    table_names = inspector.get_table_names()
    print(f"Tables after adding user: {table_names}")

    # Debug: Check if the user was actually added
    users = db.query(User).all()
    print(f"Users in database: {users}")

    # Test with valid token
    response = client.get("/login/valid_token", follow_redirects=False)
    print(f"Response status code: {response.status_code}")
    print(f"Response headers: {response.headers}")

    assert response.status_code == 307  # Expect a temporary redirect
    assert response.headers["location"] == "/dashboard"

    # Retrieve the user from the database again
    updated_user = db.query(User).filter(User.email == "test@example.com").first()

    # Verify that the token and expiry are cleared
    assert updated_user.login_token is None
    assert updated_user.token_expiry is None

    # Test with invalid token
    response = client.get("/login/invalid_token")
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired token"

    # Test with expired token
    expired_user = User(
        email="expired@example.com",
        login_token="expired_token",
        token_expiry=datetime.now(tz=timezone.utc) - timedelta(hours=1),
    )
    db.add(expired_user)
    db.commit()

    response = client.get("/login/expired_token")
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired token"
