from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./shortmail.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    vanity_name = Column(String, unique=True, index=True)
    display_name = Column(String)
    login_token = Column(String, unique=True, index=True)
    token_expiry = Column(DateTime)
    is_paid = Column(Boolean, default=False)
    subject_headings = relationship("SubjectHeading", back_populates="user")
    faqs = relationship("FAQ", back_populates="user")

class SubjectHeading(Base):
    __tablename__ = "subject_headings"
    id = Column(Integer, primary_key=True, index=True)
    heading = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="subject_headings")

class FAQ(Base):
    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="faqs")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables
Base.metadata.create_all(bind=engine)
