import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shortmail.models import Base

@pytest.fixture(scope="function")
def db_session():
    # Create an in-memory SQLite database for testing
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create all tables in the test database
    Base.metadata.create_all(bind=engine)

    # Create a new session for the test
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after the test
        Base.metadata.drop_all(bind=engine)
