"""
One-off script to delete a specific user from the database.

Run this from your backend project folder (where .env and ca.pem live):
    python delete_user.py

Edit the USERNAME / EMAIL values below before running.
"""

import os
import ssl

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_SSL_CA = os.getenv("DB_SSL_CA")

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

connect_args = {}
if DB_SSL_CA:
    ssl_context = ssl.create_default_context(cafile=DB_SSL_CA)
    connect_args["ssl"] = ssl_context

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# --------------------------------------------------
# EDIT THESE BEFORE RUNNING
# --------------------------------------------------
USERNAME_TO_DELETE = "Asif"
EMAIL_TO_DELETE = "rabiulasif02@gmail.com"
# --------------------------------------------------

with engine.connect() as conn:
    # First, show what will be deleted so you can confirm it's the right row
    result = conn.execute(
        text(
            "SELECT id, username, email, is_verified "
            "FROM users WHERE username = :username OR email = :email"
        ),
        {"username": USERNAME_TO_DELETE, "email": EMAIL_TO_DELETE},
    )
    rows = result.fetchall()

    if not rows:
        print("No matching user found. Nothing to delete.")
    else:
        print("Found the following matching user(s):")
        for row in rows:
            print(f"  id={row[0]} username={row[1]} email={row[2]} verified={row[3]}")

        confirm = input("\nType 'yes' to delete these user(s): ")
        if confirm.strip().lower() == "yes":
            conn.execute(
                text(
                    "DELETE FROM users WHERE username = :username OR email = :email"
                ),
                {"username": USERNAME_TO_DELETE, "email": EMAIL_TO_DELETE},
            )
            conn.commit()
            print("Deleted.")
        else:
            print("Cancelled, nothing deleted.")