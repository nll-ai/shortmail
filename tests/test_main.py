from fastapi.testclient import TestClient
from shortmail.app.main import app, get_current_user
from shortmail.models import User, SubjectHeading, FAQ
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_dashboard_authenticated():
    # Create a mock user
    mock_user = User(
        id=1,
        email="test@example.com",
        vanity_name="test_user",
        display_name="Test User",
        is_paid=False
    )

    # Override the get_current_user dependency
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Mock the database session
    with patch("shortmail.app.main.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_get_db.return_value.__next__.return_value = mock_db

        # Mock the database queries
        mock_subject_headings = [SubjectHeading(id=1, heading="Test Subject", user_id=1)]
        mock_faqs = [FAQ(id=1, question="Test Question", answer="Test Answer", user_id=1)]

        mock_db.query.return_value.filter.return_value.all = MagicMock(side_effect=[
            mock_subject_headings,
            mock_faqs
        ])

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
        assert "Upgrade to a paid account to change your vanity name" in response.text  # Check for upgrade message

    # Remove the dependency override after the test
    app.dependency_overrides.clear()

    print("Test completed successfully")

def test_dashboard_unauthenticated():
    # Override the get_current_user dependency to return None (unauthenticated)
    app.dependency_overrides[get_current_user] = lambda: None

    response = client.get("/dashboard", follow_redirects=False)

    # Check if the response is a redirect to the home page
    assert response.status_code == 303
    assert response.headers["location"] == "/"

    # Remove the dependency override after the test
    app.dependency_overrides.clear()
