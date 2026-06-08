import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import settings


def send_otp_email(recipient_email: str, otp: str) -> None:
    """
    Send OTP email via SMTP (Gmail app password).
    Mirrors capstone's sendotp.js using nodemailer.
    """
    sender = settings.EMAIL_USER
    password = settings.EMAIL_PASS

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your OTP — Schedex"
    msg["From"] = f"Schedex <{sender}>"
    msg["To"] = recipient_email

    # ─── Plain text fallback ──────────────────────────────────────────────────
    text_body = f"Your OTP is: {otp}\nThis code expires in 5 minutes."

    # ─── HTML email body ──────────────────────────────────────────────────────
    html_body = f"""
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto;
                background: #f8fafc; border-radius: 16px; padding: 40px;">
      <h2 style="color: #4f46e5; margin-bottom: 8px;">Verify your identity</h2>
      <p style="color: #64748b; font-size: 15px; margin-bottom: 32px;">
        Use the OTP below to complete your action on <strong>Schedex</strong>.
        This code is valid for <strong>5 minutes</strong>.
      </p>
      <div style="background: #ffffff; border: 2px solid #e0e7ff;
                  border-radius: 12px; padding: 24px; text-align: center;">
        <span style="font-size: 40px; font-weight: 800; letter-spacing: 10px;
                     color: #4f46e5;">{otp}</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
        If you did not request this, please ignore this email.
      </p>
    </div>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, recipient_email, msg.as_string())


def send_appointment_confirmation_email(
    recipient_email: str,
    customer_name: str,
    provider_name: str,
    appointment_date: str,
    time_slot: str,
) -> None:
    """Send appointment confirmation email to customer."""
    sender = settings.EMAIL_USER
    password = settings.EMAIL_PASS

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Appointment Confirmed — Schedex"
    msg["From"] = f"Schedex <{sender}>"
    msg["To"] = recipient_email

    html_body = f"""
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto;
                background: #f8fafc; border-radius: 16px; padding: 40px;">
      <h2 style="color: #059669;">Appointment Confirmed!</h2>
      <p style="color: #374151;">Hi <strong>{customer_name}</strong>,</p>
      <p style="color: #374151;">
        Your appointment with <strong>{provider_name}</strong> has been confirmed.
      </p>
      <div style="background: #ecfdf5; border-left: 4px solid #059669;
                  border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 4px 0; color: #065f46;"><strong>Date:</strong> {appointment_date}</p>
        <p style="margin: 4px 0; color: #065f46;"><strong>Time:</strong> {time_slot}</p>
        <p style="margin: 4px 0; color: #065f46;"><strong>Provider:</strong> {provider_name}</p>
      </div>
      <p style="color: #6b7280; font-size: 13px;">
        Please arrive 5 minutes early. You can manage your appointment in the Schedex dashboard.
      </p>
    </div>
    """

    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, recipient_email, msg.as_string())


def send_waitlist_slot_email(
    recipient_email: str,
    customer_name: str,
    provider_name: str,
    appointment_date: str,
    time_slot: str,
) -> None:
    sender = settings.EMAIL_USER
    password = settings.EMAIL_PASS

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Slot Available from Waitlist — Schedex"
    msg["From"] = f"Schedex <{sender}>"
    msg["To"] = recipient_email

    html_body = f"""
    <div style="font-family: 'Inter', sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; border-radius: 14px; padding: 28px;">
      <h2 style="color: #2563eb; margin-bottom: 8px;">A slot opened up for you</h2>
      <p style="color: #334155;">Hi <strong>{customer_name}</strong>, a waitlisted slot is now available.</p>
      <div style="background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Provider:</strong> {provider_name}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> {appointment_date}</p>
        <p style="margin: 4px 0;"><strong>Time:</strong> {time_slot}</p>
      </div>
      <p style="color: #64748b; font-size: 13px;">Log in to Schedex to claim this slot before it is taken.</p>
    </div>
    """
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, recipient_email, msg.as_string())


def send_waitlist_lock_email(
    recipient_email: str,
    customer_name: str,
    provider_name: str,
    appointment_date: str,
    lock_expiry_minutes: int = 30,
) -> None:
    """Send email notification when customer gets a lock on a waitlist slot."""
    sender = settings.EMAIL_USER
    password = settings.EMAIL_PASS

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"⏰ {lock_expiry_minutes}-Min Lock Available! — Schedex"
    msg["From"] = f"Schedex <{sender}>"
    msg["To"] = recipient_email

    html_body = f"""
    <div style="font-family: 'Inter', sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; border-radius: 14px; padding: 28px;">
      <h2 style="color: #d97706; margin-bottom: 8px;">🔒 You Have a {lock_expiry_minutes}-Minute Lock!</h2>
      <p style="color: #334155;">Hi <strong>{customer_name}</strong>, a slot just opened and you're at the top of the waitlist!</p>
      <div style="background: #fef3c7; border-left: 4px solid #d97706; border-radius: 8px; padding: 14px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Provider:</strong> {provider_name}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> {appointment_date}</p>
        <p style="margin: 4px 0; font-weight: bold; color: #d97706;">⏱️ Your lock expires in {lock_expiry_minutes} minutes</p>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 16px 0;">Log in to Schedex immediately to book this slot. If you don't claim it, the slot will pass to the next customer on the waitlist.</p>
      <p style="color: #64748b; font-size: 13px;"><strong>Want to release this slot to the next customer?</strong> You can do so in the app.</p>
    </div>
    """
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, recipient_email, msg.as_string())


def send_appointment_refund_email(
    recipient_email: str,
    customer_name: str,
    provider_name: str,
    appointment_date: str,
    time_slot: str,
    gross_amount: float,
    refund_amount: float,
    penalty_amount: float,
) -> None:
    """Send appointment refund receipt email to customer."""
    sender = settings.EMAIL_USER
    password = settings.EMAIL_PASS

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Refund Processed — Schedex"
    msg["From"] = f"Schedex <{sender}>"
    msg["To"] = recipient_email

    html_body = f"""
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto;
                background: #f8fafc; border-radius: 16px; padding: 40px;">
      <h2 style="color: #059669;">Refund Initiated</h2>
      <p style="color: #374151;">Hi <strong>{customer_name}</strong>,</p>
      <p style="color: #374151;">
        Your appointment with <strong>{provider_name}</strong> on {appointment_date} at {time_slot} has been cancelled. Your refund transaction has been processed.
      </p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 4px 0; color: #475569;"><strong>Gross Paid:</strong> ₹{gross_amount:.2f}</p>
        <p style="margin: 4px 0; color: #dc2626;"><strong>Cancellation Fee:</strong> ₹{penalty_amount:.2f}</p>
        <p style="margin: 4px 0; color: #059669; font-size: 16px; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 8px; mt-8;">
          <strong>Total Refunded:</strong> ₹{refund_amount:.2f}
        </p>
      </div>
      <p style="color: #6b7280; font-size: 12px; line-height: 1.5;">
        The refund has been dispatched to your original payment method. Depending on your financial institution, funds should arrive within 5-7 business days.
      </p>
    </div>
    """

    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, recipient_email, msg.as_string())


def send_provider_payment_processed_email(
    provider_email: str,
    provider_name: str,
    customer_name: str,
    appointment_date: str,
    appointment_time: str,
    amount: float,
    category: str = "Consultation",
) -> None:
    """
    Send payment processed email to provider.
    Email is sent 1 hour after appointment completion.
    """
    sender = settings.EMAIL_USER
    password = settings.EMAIL_PASS

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Payment Processed — Schedex Provider"
    msg["From"] = f"Schedex <{sender}>"
    msg["To"] = provider_email

    html_body = f"""
    <div style="font-family: 'Inter', sans-serif; max-width: 520px; margin: 0 auto;
                background: #f8fafc; border-radius: 16px; padding: 40px;">
      <h2 style="color: #059669; margin-bottom: 8px;">Payment Processed</h2>
      <p style="color: #374151; font-size: 16px;">Hi <strong>{provider_name}</strong>,</p>
      <p style="color: #6b7280; margin: 16px 0;">
        Payment for your appointment with <strong>{customer_name}</strong> has been processed and credited to your account.
      </p>
      
      <div style="background: #ecfdf5; border-left: 4px solid #059669;
                  border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 8px 0; color: #065f46;"><strong>Appointment Details</strong></p>
        <p style="margin: 6px 0; color: #065f46; font-size: 14px;">
          <strong>Date:</strong> {appointment_date}
        </p>
        <p style="margin: 6px 0; color: #065f46; font-size: 14px;">
          <strong>Time:</strong> {appointment_time}
        </p>
        <p style="margin: 6px 0; color: #065f46; font-size: 14px;">
          <strong>Customer:</strong> {customer_name}
        </p>
      </div>

      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #065f46; font-size: 13px; text-align: center;">
          <strong style="font-size: 12px;">AMOUNT RECEIVED</strong>
        </p>
        <p style="margin: 8px 0; color: #059669; font-size: 28px; font-weight: bold; text-align: center;">
          ₹{amount:.2f}
        </p>
      </div>

      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        This payment has been transferred to your registered bank account. 
        You can view transaction details in your Schedex provider dashboard.
      </p>

      <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 16px;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          <strong>Schedex</strong> • Your Appointment Management Platform<br/>
          Thank you for using Schedex! 🙏
        </p>
      </div>
    </div>
    """

    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, provider_email, msg.as_string())
