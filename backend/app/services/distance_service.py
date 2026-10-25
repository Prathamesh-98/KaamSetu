"""
KaamSetu — Distance & Location Services
Provides deterministic Haversine distance calculation, travel-time estimation,
bounding-box prefiltering, and India Standard Time (IST) same-day logic.
"""
from math import radians, cos, sin, asin, sqrt
from typing import Optional, Tuple
from datetime import datetime, date, timezone, timedelta
from zoneinfo import ZoneInfo
from app.models.models import Job, WorkType

# Earth radius in kilometers (WGS-84 mean radius)
EARTH_RADIUS_KM = 6371.0

# Indian Standard Time (IST = UTC+5:30)
try:
    KOLKATA_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    KOLKATA_TZ = timezone(timedelta(hours=5, minutes=30))


def get_current_date_ist() -> date:
    """Return current date in Asia/Kolkata timezone."""
    return datetime.now(KOLKATA_TZ).date()


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle (straight-line) distance between two points
    on the Earth using the Haversine formula.
    
    Returns distance in kilometers rounded to 2 decimal places.
    """
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2.0) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0) ** 2
    # Guard against floating-point inaccuracy outside [-1, 1] range
    a = max(0.0, min(1.0, a))
    c = 2.0 * asin(sqrt(a))
    return round(EARTH_RADIUS_KM * c, 2)


def estimate_travel_time(distance_km: float) -> str:
    """
    Return an explicitly labelled approximate commute time estimate.
    
    Assumptions & Benchmarks:
    - Straight-line distance is converted using an urban road factor of 1.3
    - Short trips (<1 km): walking benchmark (~4.5 km/h)
    - Medium/Longer trips (>=1 km): two-wheeler / auto / bus benchmark (~25 km/h urban average)
    - Labelled explicitly as an approximation. Returns None if distance is None.
    """
    if distance_km is None:
        return None
        
    if distance_km < 1.0:
        walk_mins = max(1, round((distance_km * 1.2) / (4.5 / 60)))
        return f"~{walk_mins} min walk (approx.)"
        
    # Urban road winding factor 1.3 at 25 km/h speed
    mins = max(2, round(distance_km * 3.12))
    if mins >= 60:
        hrs = mins // 60
        rem_mins = mins % 60
        if rem_mins > 0:
            return f"~{hrs}h {rem_mins}m transit (approx.)"
        return f"~{hrs}h transit (approx.)"
    return f"~{mins} mins transit (approx.)"


def calculate_bounding_box(lat: float, lon: float, radius_km: float) -> Tuple[float, float, float, float]:
    """
    Calculate bounding box [min_lat, max_lat, min_lon, max_lon] in degrees for radius_km.
    1 degree latitude ~= 111.045 km
    1 degree longitude ~= 111.045 * cos(lat) km
    """
    delta_lat = radius_km / 111.045
    min_lat = max(-90.0, lat - delta_lat)
    max_lat = min(90.0, lat + delta_lat)
    
    cos_lat = max(cos(radians(lat)), 0.01)
    delta_lon = radius_km / (111.045 * cos_lat)
    min_lon = max(-180.0, lon - delta_lon)
    max_lon = min(180.0, lon + delta_lon)
    
    return min_lat, max_lat, min_lon, max_lon


def is_same_day_job(job_start_date: Optional[date], work_type: WorkType, is_urgent: bool, reference_date: Optional[date] = None) -> bool:
    """
    Evaluate whether a job qualifies for 'same-day' eligibility.
    
    Definition:
    1. The job's scheduled start_date is today (in Asia/Kolkata timezone), OR
    2. The job is an urgent daily/hourly/local job active today (start_date is None or <= today).
    """
    today = reference_date or get_current_date_ist()
    if job_start_date == today:
        return True
    if work_type in [WorkType.DAILY, WorkType.HOURLY, WorkType.LOCAL] and is_urgent:
        if job_start_date is None or job_start_date <= today:
            return True
    return False
