import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationMessage


async def get_or_create(
    session: AsyncSession,
    channel: str,
    external_id: str,
    agent_id: uuid.UUID,
    title: str | None = None,
) -> Conversation:
    result = await session.execute(
        select(Conversation).where(
            Conversation.channel == channel,
            Conversation.external_id == external_id,
            Conversation.agent_id == agent_id,
        )
    )
    conv = result.scalar_one_or_none()
    if conv is not None:
        return conv
    conv = Conversation(
        channel=channel, external_id=external_id, agent_id=agent_id, title=title
    )
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return conv


async def list_conversations(session: AsyncSession) -> list[Conversation]:
    result = await session.execute(
        select(Conversation).order_by(Conversation.last_activity_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation(session: AsyncSession, conv_id: uuid.UUID) -> Conversation | None:
    return await session.get(Conversation, conv_id)


async def list_messages(session: AsyncSession, conv_id: uuid.UUID) -> list[ConversationMessage]:
    result = await session.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conv_id)
        .order_by(ConversationMessage.created_at)
    )
    return list(result.scalars().all())


async def add_message(
    session: AsyncSession,
    conv: Conversation,
    role: str,
    content: str,
    run_id: uuid.UUID | None = None,
) -> ConversationMessage:
    msg = ConversationMessage(
        conversation_id=conv.id, role=role, content=content, run_id=run_id
    )
    session.add(msg)
    conv.last_activity_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(msg)
    return msg
