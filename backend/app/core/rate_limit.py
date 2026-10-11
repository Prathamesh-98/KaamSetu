"""
KaamSetu - Rate Limiting
Simple in-memory rate limiter for authentication endpoints.
NOTE: This is an in-memory implementation. It resets on restart and does not share state across multiple workers or instances.
For production deployments with multiple instances (e.g., Kubernetes, Gunicorn with multiple workers), a Redis-based rate limiter (like slowapi with a Redis backend) should be used instead.
"""
import time
from fastapi import Request, HTTPException, status
from collections import defaultdict
from typing import Dict, Tuple

# In-memory store: {ip_address: (count, reset_time)}
_rate_limits: Dict[str, Tuple[int, float]] = defaultdict(lambda: (0, 0.0))

class RateLimiter:
    def __init__(self, requests: int, window_seconds: int):
        self.requests = requests
        self.window_seconds = window_seconds

    def __call__(self, request: Request):
        # Extract client IP securely
        # DO NOT blindly trust X-Forwarded-For if not behind a trusted proxy,
        # but for this basic implementation we will check standard headers or fallback to client.host.
        client_ip = request.client.host if request.client else "127.0.0.1"
        
        # If behind a trusted proxy, this can be uncommented and adjusted:
        # forwarded_for = request.headers.get("X-Forwarded-For")
        # if forwarded_for:
        #     client_ip = forwarded_for.split(",")[0].strip()

        now = time.time()
        
        count, reset_time = _rate_limits[client_ip]
        
        if now > reset_time:
            # Window expired, reset
            _rate_limits[client_ip] = (1, now + self.window_seconds)
            return

        if count >= self.requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later."
            )
            
        # Increment counter
        _rate_limits[client_ip] = (count + 1, reset_time)
