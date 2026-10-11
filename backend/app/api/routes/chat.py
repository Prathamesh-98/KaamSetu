from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update, desc
from sqlalchemy.orm import selectinload, joinedload
from uuid import UUID
from typing import List

from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.models.models import (
    User, UserRole, Conversation, Message, JobApplication, ApplicationStatus,
    WorkerProfile, EmployerProfile, Job, MessageType, WorkerSkill, Skill
)
from app.schemas.schemas import (
    ConversationResponse, WorkerProfileResponse, EmployerProfileResponse,
    MessageResponse, MessageCreate, UnreadCountResponse,
    PaginatedMessageResponse
)

router = APIRouter()


def _conv_options():
    """Eagerly load all relations needed for ConversationResponse serialization."""
    return [
        joinedload(Conversation.worker)
            .joinedload(WorkerProfile.user),
        joinedload(Conversation.worker)
            .selectinload(WorkerProfile.skills)
            .joinedload(WorkerSkill.skill),
        joinedload(Conversation.employer)
            .joinedload(EmployerProfile.user),
        joinedload(Conversation.application),
    ]


def _build_conv_response(
    conv: Conversation,
    application_status: ApplicationStatus,
    unread_count: int = 0,
    last_message=None,
) -> ConversationResponse:
    """Build ConversationResponse, injecting application_status before Pydantic validation."""
    worker_data = WorkerProfileResponse.model_validate(conv.worker)
    employer_data = EmployerProfileResponse.model_validate(conv.employer)
    return ConversationResponse(
        id=conv.id,
        application_id=conv.application_id,
        worker=worker_data,
        employer=employer_data,
        last_message_at=conv.last_message_at,
        created_at=conv.created_at,
        unread_count=unread_count,
        last_message=MessageResponse.model_validate(last_message) if last_message else None,
        application_status=application_status,
    )

@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all active conversations for the current user."""
    query = select(Conversation).options(*_conv_options())

    if current_user.role == UserRole.WORKER:
        worker_query = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        worker = worker_query.scalar_one_or_none()
        if not worker:
            return []
        query = query.where(Conversation.worker_id == worker.id)
    elif current_user.role == UserRole.EMPLOYER:
        employer_query = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        employer = employer_query.scalar_one_or_none()
        if not employer:
            return []
        query = query.where(Conversation.employer_id == employer.id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized for messaging")

    query = query.order_by(Conversation.last_message_at.desc().nulls_last(), Conversation.created_at.desc())
    result = await db.execute(query)
    conversations = result.scalars().all()

    if not conversations:
        return []

    conv_ids = [conv.id for conv in conversations]

    # Batch query 1: Unread counts across all user conversations in a single aggregate query
    unread_query = (
        select(Message.conversation_id, func.count(Message.id).label("unread_count"))
        .where(
            Message.conversation_id.in_(conv_ids),
            Message.sender_id != current_user.id,
            Message.is_read == False,
        )
        .group_by(Message.conversation_id)
    )
    unread_res = await db.execute(unread_query)
    unread_map = {row.conversation_id: row.unread_count for row in unread_res.all()}

    # Batch query 2: Latest message for each conversation using PostgreSQL DISTINCT ON
    last_msg_query = (
        select(Message)
        .where(Message.conversation_id.in_(conv_ids))
        .distinct(Message.conversation_id)
        .order_by(Message.conversation_id, Message.sent_at.desc())
    )
    last_msg_res = await db.execute(last_msg_query)
    last_msg_map = {m.conversation_id: m for m in last_msg_res.scalars().all()}

    response_data = []
    for conv in conversations:
        unread_count = unread_map.get(conv.id, 0)
        last_msg = last_msg_map.get(conv.id)
        app_status = conv.application.status if conv.application else ApplicationStatus.PENDING
        response_data.append(_build_conv_response(conv, app_status, unread_count, last_msg))

    return response_data


@router.post("/conversations/application/{application_id}", response_model=ConversationResponse)
async def get_or_create_conversation(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get existing or create new conversation for an application."""
    app_query = await db.execute(
        select(JobApplication)
        .options(joinedload(JobApplication.job))
        .where(JobApplication.id == application_id)
    )
    application = app_query.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status not in [ApplicationStatus.SHORTLISTED, ApplicationStatus.ACCEPTED]:
        raise HTTPException(status_code=403, detail="Messaging is only available for shortlisted or accepted applications")

    worker_id = application.worker_id
    employer_id = application.job.employer_id

    is_authorized = False
    if current_user.role == UserRole.WORKER:
        w_query = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        w_profile = w_query.scalar_one_or_none()
        if w_profile and w_profile.id == worker_id:
            is_authorized = True
    elif current_user.role == UserRole.EMPLOYER:
        e_query = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        e_profile = e_query.scalar_one_or_none()
        if e_profile and e_profile.id == employer_id:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="You do not have permission to message on this application")

    # Get existing or create new conversation
    conv_query = await db.execute(
        select(Conversation)
        .options(*_conv_options())
        .where(Conversation.application_id == application_id)
    )
    conversation = conv_query.scalar_one_or_none()

    if not conversation:
        conversation = Conversation(
            application_id=application_id,
            worker_id=worker_id,
            employer_id=employer_id
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

        # Reload with all relations eagerly loaded
        conv_query = await db.execute(
            select(Conversation)
            .options(*_conv_options())
            .where(Conversation.id == conversation.id)
        )
        conversation = conv_query.scalar_one()

    return _build_conv_response(conversation, application.status, unread_count=0)

@router.get("/conversations/{conversation_id}/messages", response_model=PaginatedMessageResponse)
async def get_messages(
    conversation_id: UUID,
    page: int = 1,
    size: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get paginated messages for a conversation."""
    conv_query = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = conv_query.scalar_one_or_none()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Verify auth
    if current_user.role == UserRole.WORKER:
        w_query = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        w = w_query.scalar_one_or_none()
        if not w or w.id != conv.worker_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
    elif current_user.role == UserRole.EMPLOYER:
        e_query = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        e = e_query.scalar_one_or_none()
        if not e or e.id != conv.employer_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    count_query = select(func.count(Message.id)).where(Message.conversation_id == conversation_id)
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()
    
    msg_query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.sent_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    msg_res = await db.execute(msg_query)
    # Re-reverse to chronological order for UI
    messages = msg_res.scalars().all()[::-1]
    
    return PaginatedMessageResponse(
        items=messages,
        total=total,
        page=page,
        page_size=size,
        total_pages=(total + size - 1) // size
    )

@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: UUID,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a new message."""
    conv_query = await db.execute(
        select(Conversation)
        .options(joinedload(Conversation.application))
        .where(Conversation.id == conversation_id)
    )
    conv = conv_query.scalar_one_or_none()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if conv.application and conv.application.status not in [ApplicationStatus.SHORTLISTED, ApplicationStatus.ACCEPTED]:
        raise HTTPException(status_code=403, detail="Messaging is only available for shortlisted or accepted applications")

    # Verify auth
    if current_user.role == UserRole.WORKER:
        w_query = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        w = w_query.scalar_one_or_none()
        if not w or w.id != conv.worker_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
    elif current_user.role == UserRole.EMPLOYER:
        e_query = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        e = e_query.scalar_one_or_none()
        if not e or e.id != conv.employer_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=payload.content.strip()
    )
    db.add(msg)
    conv.last_message_at = func.now()
    await db.commit()
    await db.refresh(msg)
    
    return msg

@router.post("/conversations/{conversation_id}/read")
async def mark_read(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in a conversation as read."""
    conv_query = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = conv_query.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify participant authorization (prevent IDOR)
    if current_user.role == UserRole.WORKER:
        w_query = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        w = w_query.scalar_one_or_none()
        if not w or w.id != conv.worker_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    elif current_user.role == UserRole.EMPLOYER:
        e_query = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        e = e_query.scalar_one_or_none()
        if not e or e.id != conv.employer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
        
    stmt = (
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.is_read == False
        )
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"success": True}

@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_total_unread(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get total unread message count."""
    count = 0
    if current_user.role == UserRole.WORKER:
        w_query = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        w = w_query.scalar_one_or_none()
        if w:
            q = select(func.count(Message.id)).join(Conversation).where(
                Conversation.worker_id == w.id,
                Message.sender_id != current_user.id,
                Message.is_read == False
            )
            res = await db.execute(q)
            count = res.scalar_one()
    elif current_user.role == UserRole.EMPLOYER:
        e_query = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        e = e_query.scalar_one_or_none()
        if e:
            q = select(func.count(Message.id)).join(Conversation).where(
                Conversation.employer_id == e.id,
                Message.sender_id != current_user.id,
                Message.is_read == False
            )
            res = await db.execute(q)
            count = res.scalar_one()

    return UnreadCountResponse(unread_count=count)
