import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from anyio import to_thread

from app.config import Settings


def _send_email_sync(settings: Settings, to_email: str, subject: str, text: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = to_email
    message.set_content(text)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


async def send_otp_email(settings: Settings, to_email: str, code: str) -> None:
    text = (
        f"Your Cordial sign-in code is {code}.\n\n"
        "It expires in 10 minutes. If you did not request this code, you can ignore this email."
    )
    await to_thread.run_sync(_send_email_sync, settings, to_email, "Your Cordial sign-in code", text)
