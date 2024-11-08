"""
Rate limiting models for the ShortMail application.
"""

from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from fastapi import HTTPException


class RateLimit(BaseModel):
    """Rate limit tracking for an IP address."""

    ip: str
    attempts: int = 0
    reset_time: datetime
    blocked_until: Optional[datetime] = None


class RateLimiter:
    """Rate limiter implementation."""

    def __init__(self):
        self.limits: dict[str, RateLimit] = {}

    def check_rate_limit(
        self, ip: str, max_attempts: int = 5, window_seconds: int = 3600
    ) -> None:
        """
        Check if an IP has exceeded its rate limit.

        :param ip: IP address to check
        :param max_attempts: Maximum number of attempts allowed in the window
        :param window_seconds: Time window in seconds
        :raises HTTPException: If rate limit is exceeded
        """
        now = datetime.now()

        # Clean up old entries
        self._cleanup_old_entries()

        if ip not in self.limits:
            self.limits[ip] = RateLimit(
                ip=ip, reset_time=now + timedelta(seconds=window_seconds)
            )

        limit = self.limits[ip]

        # Check if IP is blocked
        if limit.blocked_until and now < limit.blocked_until:
            wait_seconds = int((limit.blocked_until - now).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Please try again in {wait_seconds} seconds.",  # noqa: E501
            )

        # Reset if window has expired
        if now > limit.reset_time:
            limit.attempts = 0
            limit.reset_time = now + timedelta(seconds=window_seconds)
            limit.blocked_until = None

        limit.attempts += 1

        # Block if too many attempts
        if limit.attempts > max_attempts:
            limit.blocked_until = now + timedelta(minutes=30)
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please try again in 30 minutes.",
            )

    def _cleanup_old_entries(self):
        """Remove expired entries from the limits dictionary."""
        now = datetime.now()
        self.limits = {
            ip: limit
            for ip, limit in self.limits.items()
            if now < limit.reset_time
            or (limit.blocked_until and now < limit.blocked_until)
        }
