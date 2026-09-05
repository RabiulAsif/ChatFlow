import os

from dotenv import load_dotenv
from fastapi_mail import (
    ConnectionConfig,
    FastMail,
    MessageSchema,
    MessageType,
)

load_dotenv()


conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)

# Your live frontend URL in production (set FRONTEND_URL in Render's
# environment variables once Vercel gives you a domain). Falls back to
# localhost for local development.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


async def send_verification_email(
    email: str,
    username: str,
    token: str,
):
    verification_link = (
        f"{FRONTEND_URL}/verify-email?token={token}"
    )

    html = f"""
    <html>
        <body>
            <h2>Welcome to ChatFlow!</h2>

            <p>Hello {username},</p>

            <p>
                Thanks for creating your ChatFlow account.
            </p>

            <p>
                Please verify your email address by clicking
                the button below:
            </p>

            <a
                href="{verification_link}"
                style="
                    display:inline-block;
                    padding:12px 20px;
                    background:#2563eb;
                    color:white;
                    text-decoration:none;
                    border-radius:6px;
                "
            >
                Verify Email
            </a>

            <p>
                If you did not create this account,
                you can ignore this email.
            </p>
        </body>
    </html>
    """

    message = MessageSchema(
        subject="Verify your ChatFlow account",
        recipients=[email],
        body=html,
        subtype=MessageType.html,
    )

    fm = FastMail(conf)

    await fm.send_message(message)