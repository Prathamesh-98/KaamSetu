from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.api.dependencies import get_current_user, get_db
from app.models.models import User, Rating, JobApplication, Job, ApplicationStatus, WorkerProfile, EmployerProfile, UserRole, RaterRole
from app.schemas.schemas import RatingCreate, RatingResponse

router = APIRouter(tags=["Ratings"])

@router.post("/ratings", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
async def create_rating(
    payload: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Determine the role of the rater
    if current_user.role == UserRole.WORKER:
        rater_role = RaterRole.WORKER
    elif current_user.role == UserRole.EMPLOYER:
        rater_role = RaterRole.EMPLOYER
    else:
        raise HTTPException(status_code=403, detail="Only WORKER or EMPLOYER can rate")

    if payload.rater_role != rater_role:
        raise HTTPException(status_code=400, detail="Invalid rater_role in payload")

    # Fetch the application
    query = select(JobApplication).where(JobApplication.id == payload.application_id).options(
        selectinload(JobApplication.job).selectinload(Job.employer),
        selectinload(JobApplication.worker)
    )
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check if application is in a terminal/completed state
    # Actually, any state like ACCEPTED or COMPLETED. We'll check if it's ACCEPTED or COMPLETED.
    if application.status not in [ApplicationStatus.ACCEPTED, ApplicationStatus.COMPLETED]:
        raise HTTPException(status_code=400, detail="Can only rate completed or accepted applications")

    # Validate ownership
    if rater_role == RaterRole.WORKER:
        if application.worker.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your application")
        rated_user_id = application.job.employer.user_id
    else:
        if application.job.employer.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your application")
        rated_user_id = application.worker.user_id

    # Check if already rated
    query = select(Rating).where(
        Rating.application_id == payload.application_id,
        Rating.rated_by == current_user.id
    )
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already rated this application")

    rating = Rating(
        application_id=payload.application_id,
        rated_by=current_user.id,
        rated_user=rated_user_id,
        rating=payload.rating,
        review_text=payload.review_text,
        rater_role=rater_role
    )
    db.add(rating)
    await db.flush()

    # Update aggregates
    # Get current total and avg from db directly to avoid race conditions as much as possible, or just update the profile
    if rater_role == RaterRole.WORKER:
        # Rated user is Employer
        prof_query = select(EmployerProfile).where(EmployerProfile.user_id == rated_user_id)
    else:
        prof_query = select(WorkerProfile).where(WorkerProfile.user_id == rated_user_id)
        
    result = await db.execute(prof_query)
    profile = result.scalar_one_or_none()

    if profile:
        new_total = profile.total_ratings + 1
        new_avg = ((profile.average_rating * profile.total_ratings) + payload.rating) / new_total
        profile.total_ratings = new_total
        profile.average_rating = new_avg

    await db.commit()
    await db.refresh(rating)
    
    # Eager load rater for response
    query = select(Rating).where(Rating.id == rating.id).options(selectinload(Rating.rater))
    result = await db.execute(query)
    return result.scalar_one()

@router.get("/ratings/user/{user_id}", response_model=List[RatingResponse])
async def get_user_ratings(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(Rating).where(Rating.rated_user == user_id).options(
        selectinload(Rating.rater)
    ).order_by(Rating.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
