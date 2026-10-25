"""
KaamSetu — Resend Test Email Script
Sends a single test email using the configured ResendEmailProvider without exposing secrets or OTP values.
"""
import sys
import asyncio
from app.core.config import settings
from app.services.email_service import ResendEmailProvider

async def send_test(recipient: str, sender: str = None):
    provider = ResendEmailProvider()
    if sender:
        provider.from_email = sender
    
    print(f"Testing Resend email delivery:")
    print(f"  Provider Configured: {provider.is_configured()}")
    print(f"  Sender Address: {provider.from_email}")
    print(f"  Recipient: {recipient[:3]}***@{recipient.split('@')[-1] if '@' in recipient else 'unknown'}")
    
    subject = "KaamSetu — Resend Integration Test"
    text_body = "Hello! This is a test email from KaamSetu verifying that Resend email delivery is working properly."
    html_body = "<div style='font-family: Arial, sans-serif; padding: 20px;'><h2>KaamSetu Resend Integration Test</h2><p>This email confirms that Resend email delivery is configured and working properly.</p></div>"
    
    success, message = await provider.send_email(
        to_email=recipient,
        subject=subject,
        body_text=text_body,
        body_html=html_body,
    )
    
    print(f"  Result: {'ACCEPTED' if success else 'FAILED'}")
    print(f"  Detail: {message}")
    return success

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python send_test_email.py <recipient_email> [sender_email]")
        sys.exit(1)
    
    to_addr = sys.argv[1].strip()
    from_addr = sys.argv[2].strip() if len(sys.argv) > 2 else None
    
    asyncio.run(send_test(to_addr, from_addr))
