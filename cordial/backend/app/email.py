import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from anyio import to_thread

from app.config import Settings


def _send_email_sync(settings: Settings, to_email: str, subject: str, text: str, html: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = to_email
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    smtp_client = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
    with smtp_client(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
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
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#0b1220">
      <div style="font-size:14px;font-weight:700;color:#2563eb;margin-bottom:20px">Cordial</div>
      <h1 style="font-size:24px;margin:0 0 12px">Your sign-in code</h1>
      <p style="font-size:15px;line-height:1.6;color:#334155">Use this code to continue into Cordial. It expires in 10 minutes.</p>
      <div style="font-size:34px;letter-spacing:8px;font-weight:800;background:#f1f7ff;border:1px solid #d8e6f7;border-radius:12px;padding:18px 20px;margin:22px 0;text-align:center">
        {code}
      </div>
      <p style="font-size:13px;line-height:1.6;color:#64748b">If you did not request this code, you can ignore this email.</p>
    </div>
    """
    await to_thread.run_sync(_send_email_sync, settings, to_email, "Your Cordial sign-in code", text, html)
