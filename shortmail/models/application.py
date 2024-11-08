"""
Models for the ShortMail application.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import relationship, sessionmaker, declarative_base


Base = declarative_base()

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./data/shortmail.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class User(Base):
    """
    User model representing a user in the ShortMail application.

    This model stores user information including email, display name,
    authentication details, and subscription status.
    It also maintains relationships with subject headings and FAQs.

    :param id: Unique identifier for the user
    :param email: User's email address
    :param vanity_name: Unique vanity name for the user's profile
    :param display_name: User's display name
    :param is_paid: Whether the user has a paid subscription
    :param login_token: Token used for authentication
    :param token_expiry: Expiration datetime of the login token
    :param is_admin: Whether the user has admin privileges
    :param subject_headings: List of subject headings created by the user
    :param faqs: List of FAQs created by the user
    """

    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    vanity_name = Column(String, unique=True, index=True)
    display_name = Column(String)
    is_paid = Column(Boolean, default=False)
    login_token = Column(String)
    token_expiry = Column(DateTime)
    is_admin = Column(Boolean, default=False)  # New field
    subject_headings = relationship("SubjectHeading", back_populates="user")
    faqs = relationship("FAQ", back_populates="user")


class SubjectHeading(Base):
    """
    Subject heading model representing email subject headings in the ShortMail application.

    This model stores subject headings that users can create and associate with their account.
    Each subject heading belongs to a specific user.

    :param id: Unique identifier for the subject heading
    :param heading: The subject heading text
    :param user_id: ID of the user who created this subject heading
    :param user: Relationship to the user who created this subject heading
    """

    __tablename__ = "subject_headings"
    id = Column(Integer, primary_key=True, index=True)
    heading = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="subject_headings")


class FAQ(Base):
    """
    FAQ model representing frequently asked questions in the ShortMail application.

    This model stores FAQ entries that users can create and associate with their account.
    Each FAQ contains a question and answer pair and belongs to a specific user.

    :param id: Unique identifier for the FAQ
    :param question: The FAQ question text
    :param answer: The FAQ answer text
    :param user_id: ID of the user who created this FAQ
    :param user: Relationship to the user who created this FAQ
    """

    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="faqs")


def get_db():
    """
    Get a database session.

    This function creates a new database session and ensures it is properly closed
    after use. It is designed to be used as a FastAPI dependency.

    :yield: A SQLAlchemy Session object that can be used for database operations
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create tables
Base.metadata.create_all(bind=engine)
