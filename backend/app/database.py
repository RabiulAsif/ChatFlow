import os
import ssl

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# Load variables from .env (only used locally; on Render the real
# environment variables are injected directly, load_dotenv is a no-op there)
load_dotenv()


# Read database configuration
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Path to the CA certificate Aiven provides. Aiven enforces
# ssl-mode=REQUIRED on every connection, so this must point at a real
# file: a local ca.pem path in development, or a Render Secret File
# path (e.g. /etc/secrets/ca.pem) in production.
DB_SSL_CA = os.getenv("DB_SSL_CA")


# MySQL connection URL
DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)


# Build SSL connect args for PyMySQL. Without this, PyMySQL will not
# present/verify the CA certificate that Aiven requires.
connect_args = {}

if DB_SSL_CA:
    ssl_context = ssl.create_default_context(cafile=DB_SSL_CA)
    connect_args["ssl"] = ssl_context


# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)


# Base class for all database models
Base = declarative_base()


# Create a database session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)