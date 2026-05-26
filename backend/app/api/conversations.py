import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.repos import conversations as repo
from app.schemas.conversation import ConversationMessageRead, ConversationRead

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationRead])
async def list_conversations(session: AsyncSession = Depends(get_session)):
    return await repo.list_conversations(session)


@router.get("/{conv_id}", response_model=ConversationRead)
async def get_conversation(conv_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    conv = await repo.get_conversation(session, conv_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.get("/{conv_id}/messages", response_model=list[ConversationMessageRead])
async def list_messages(conv_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    conv = await repo.get_conversation(session, conv_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await repo.list_messages(session, conv_id)
