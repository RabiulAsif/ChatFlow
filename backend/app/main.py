from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
import secrets
from app import models
from app.auth import (
    create_access_token,
    verify_access_token,
    password_hash,
    verify_password
)
from app.database import Base, SessionLocal, engine
from app.email_service import send_verification_email
from app.schemas import (
    ConversationCreate,
    MessageCreate,
    MessageResponse,
    Token,
    UserCreate,
    UserLogin,
)
from app.websocket_manager import ConnectionManager
# --------------------------------------------------
# FastAPI Application
# --------------------------------------------------
app = FastAPI(
    title="ChatFlow API",
    description="Real-time chat application backend",
    version="1.0.0",
)
# --------------------------------------------------
# CORS
# --------------------------------------------------
# Reads a comma-separated list of allowed origins from the
# CORS_ORIGINS environment variable in production (e.g. your
# Vercel URL). Falls back to local dev origins if unset.
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
allowed_origins = (
    [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    or [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --------------------------------------------------
# Database
# --------------------------------------------------
Base.metadata.create_all(bind=engine)
# --------------------------------------------------
# Security
# --------------------------------------------------
security = HTTPBearer()
# --------------------------------------------------
# WebSocket Connection Manager
# --------------------------------------------------
manager = ConnectionManager()
# --------------------------------------------------
# Root
# --------------------------------------------------
@app.get("/")
def root():
    return {
        "message": "ChatFlow backend is running!"
    }
# --------------------------------------------------
# Database Test
# --------------------------------------------------
@app.get("/db-test")
def database_test():
    db = SessionLocal()
    try:
        return {
            "message": "Database connection successful!",
            "database": "chatflow_db"
        }
    finally:
        db.close()
# --------------------------------------------------
# Register
# --------------------------------------------------
@app.post("/register")
async def register(user: UserCreate):
    db: Session = SessionLocal()
    try:
        # Check username
        existing_username = (
            db.query(models.User)
            .filter(
                models.User.username == user.username
            )
            .first()
        )
        if existing_username:
            raise HTTPException(
                status_code=400,
                detail="Username already exists",
            )
        # Check email
        existing_email = (
            db.query(models.User)
            .filter(
                models.User.email == user.email
            )
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Email already exists",
            )
        # Hash password
        hashed_password = password_hash.hash(
            user.password
        )
        # Create verification token
        verification_token = secrets.token_urlsafe(32)
        # Create user
        new_user = models.User(
            username=user.username,
            email=user.email,
            password=hashed_password,
            is_verified=False,
            verification_token=verification_token,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        # Send verification email
        await send_verification_email(
            email=new_user.email,
            username=new_user.username,
            token=verification_token,
        )
        return {
            "message": (
                "Registration successful. "
                "Please verify your email."
            ),
            "user_id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
        }
    finally:
        db.close()
# --------------------------------------------------
# Verify Email
# --------------------------------------------------
@app.get("/verify-email")
def verify_email(token: str):
    db: Session = SessionLocal()
    try:
        user = (
            db.query(models.User)
            .filter(
                models.User.verification_token == token
            )
            .first()
        )
        if not user:
            raise HTTPException(
                status_code=400,
                detail="Invalid verification token"
            )
        if user.is_verified:
            return {
                "message": "Email is already verified."
            }
        user.is_verified = True
        user.verification_token = None
        db.commit()
        return {
            "message": "Email verified successfully!"
        }
    finally:
        db.close()
# --------------------------------------------------
# Login
# --------------------------------------------------
@app.post("/login", response_model=Token)
def login(user: UserLogin):
    db: Session = SessionLocal()
    try:
        # Find user by email
        existing_user = (
            db.query(models.User)
            .filter(
                models.User.email == user.email
            )
            .first()
        )
        # User not found
        if not existing_user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        # Verify password
        if not verify_password(
            user.password,
            existing_user.password
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        # Check email verification
        if not existing_user.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Please verify your email before logging in."
            )
        # Create JWT token
        access_token = create_access_token(
            {
                "sub": str(existing_user.id)
            }
        )
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    finally:
        db.close()
# --------------------------------------------------
# Get Current User
# --------------------------------------------------
@app.get("/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Get token
    token = credentials.credentials
    try:
        # Verify token
        current_user_id = verify_access_token(token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    db: Session = SessionLocal()
    try:
        # Find current user
        user = (
            db.query(models.User)
            .filter(
                models.User.id == current_user_id
            )
            .first()
        )
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at
        }
    finally:
        db.close()
# --------------------------------------------------
# Search Users
# --------------------------------------------------
@app.get("/users/search")
def search_users(
    username: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Get token
    token = credentials.credentials
    try:
        # Verify token
        current_user_id = verify_access_token(token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    db: Session = SessionLocal()
    try:
        # Search users by username
        users = (
            db.query(models.User)
            .filter(
                models.User.username.ilike(
                    f"%{username}%"
                ),
                models.User.id != current_user_id
            )
            .all()
        )
        return [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
            for user in users
        ]
    finally:
        db.close()
# --------------------------------------------------
# Create Conversation
# --------------------------------------------------
@app.post("/conversations")
def create_conversation(
    conversation_data: ConversationCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Get token
    token = credentials.credentials
    try:
        # Get current user's ID
        current_user_id = verify_access_token(token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    db: Session = SessionLocal()
    try:
        other_user_id = conversation_data.user_id
        # Prevent self conversation
        if current_user_id == other_user_id:
            raise HTTPException(
                status_code=400,
                detail="You cannot create a conversation with yourself"
            )
        # Check whether other user exists
        other_user = (
            db.query(models.User)
            .filter(
                models.User.id == other_user_id
            )
            .first()
        )
        if not other_user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        # Check existing conversation
        existing_conversation = (
            db.query(models.Conversation)
            .filter(
                (
                    (models.Conversation.user1_id == current_user_id)
                    &
                    (models.Conversation.user2_id == other_user_id)
                )
                |
                (
                    (models.Conversation.user1_id == other_user_id)
                    &
                    (models.Conversation.user2_id == current_user_id)
                )
            )
            .first()
        )
        # Return existing conversation
        if existing_conversation:
            return {
                "message": "Conversation already exists",
                "conversation_id": existing_conversation.id
            }
        # Create conversation
        new_conversation = models.Conversation(
            user1_id=current_user_id,
            user2_id=other_user_id
        )
        db.add(new_conversation)
        db.commit()
        db.refresh(new_conversation)
        return {
            "message": "Conversation created successfully!",
            "conversation_id": new_conversation.id
        }
    finally:
        db.close()
# --------------------------------------------------
# Send Message - REST API
# --------------------------------------------------
@app.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse
)
def send_message(
    conversation_id: int,
    message: MessageCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Get JWT token
    token = credentials.credentials
    try:
        # Get current user's ID
        current_user_id = verify_access_token(token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    db: Session = SessionLocal()
    try:
        # Find conversation
        conversation = (
            db.query(models.Conversation)
            .filter(
                models.Conversation.id == conversation_id
            )
            .first()
        )
        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )
        # Check membership
        if current_user_id not in [
            conversation.user1_id,
            conversation.user2_id
        ]:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this conversation"
            )
        # Prevent empty message
        if not message.content.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        # Create message
        new_message = models.Message(
            conversation_id=conversation_id,
            sender_id=current_user_id,
            content=message.content.strip()
        )
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        return new_message
    finally:
        db.close()
# --------------------------------------------------
# Get Message History
# --------------------------------------------------
@app.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse]
)
def get_messages(
    conversation_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Get JWT token
    token = credentials.credentials
    try:
        # Verify token
        current_user_id = verify_access_token(token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    db: Session = SessionLocal()
    try:
        # Find conversation
        conversation = (
            db.query(models.Conversation)
            .filter(
                models.Conversation.id == conversation_id
            )
            .first()
        )
        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )
        # Check membership
        if current_user_id not in [
            conversation.user1_id,
            conversation.user2_id
        ]:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this conversation"
            )
        # Get messages
        messages = (
            db.query(models.Message)
            .filter(
                models.Message.conversation_id == conversation_id
            )
            .order_by(
                models.Message.created_at.asc()
            )
            .all()
        )
        return messages
    finally:
        db.close()
# --------------------------------------------------
# WebSocket - Real-Time Chat
# --------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str
):
    # Verify JWT token
    try:
        current_user_id = verify_access_token(token)
    except ValueError:
        await websocket.close(code=1008)
        return
    # Connect user
    await manager.connect(
        current_user_id,
        websocket
    )
    # Notify conversation users that this user is online
    db: Session = SessionLocal()
    try:
        conversations = (
            db.query(models.Conversation)
            .filter(
                (models.Conversation.user1_id == current_user_id)
                |
                (models.Conversation.user2_id == current_user_id)
            )
            .all()
        )
        for conversation in conversations:
            if conversation.user1_id == current_user_id:
                recipient_id = conversation.user2_id
            else:
                recipient_id = conversation.user1_id
            # Tell the other user that I just came online
            await manager.send_personal_message(
                {
                    "type": "status",
                    "user_id": current_user_id,
                    "status": "online"
                },
                recipient_id
            )
            # Tell me the other user's current online status
            # (they may have connected before me, so I never
            # got their "online" announcement)
            await manager.send_personal_message(
                {
                    "type": "status",
                    "user_id": recipient_id,
                    "status": (
                        "online"
                        if manager.is_online(recipient_id)
                        else "offline"
                    )
                },
                current_user_id
            )
    finally:
        db.close()
    try:
        while True:
            # Receive JSON data
            data = await websocket.receive_json()
            # Get message type
            message_type = data.get("type")
            # ==================================================
            # TYPING INDICATOR
            # ==================================================
            if message_type == "typing":
                conversation_id = data.get(
                    "conversation_id"
                )
                is_typing = data.get(
                    "is_typing",
                    False
                )
                if not conversation_id:
                    continue
                db: Session = SessionLocal()
                try:
                    conversation = (
                        db.query(models.Conversation)
                        .filter(
                            models.Conversation.id
                            == conversation_id
                        )
                        .first()
                    )
                    if not conversation:
                        continue
                    # Check membership
                    if current_user_id not in [
                        conversation.user1_id,
                        conversation.user2_id
                    ]:
                        continue
                    # Find recipient
                    if conversation.user1_id == current_user_id:
                        recipient_id = conversation.user2_id
                    else:
                        recipient_id = conversation.user1_id
                    # Send typing status
                    await manager.send_personal_message(
                        {
                            "type": "typing",
                            "conversation_id": conversation_id,
                            "user_id": current_user_id,
                            "is_typing": is_typing
                        },
                        recipient_id
                    )
                finally:
                    db.close()
                continue
            # ==================================================
            # DELETE MESSAGE
            # ==================================================
            if message_type == "delete_message":
                message_id = data.get("message_id")
                if not message_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "message_id is required"
                    })
                    continue
                db: Session = SessionLocal()
                try:
                    message = (
                        db.query(models.Message)
                        .filter(
                            models.Message.id == message_id
                        )
                        .first()
                    )
                    if not message:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Message not found"
                        })
                        continue
                    # Only sender can delete
                    if message.sender_id != current_user_id:
                        await websocket.send_json({
                            "type": "error",
                            "message": "You can only delete your own messages"
                        })
                        continue
                    conversation_id = message.conversation_id
                    conversation = (
                        db.query(models.Conversation)
                        .filter(
                            models.Conversation.id == conversation_id
                        )
                        .first()
                    )
                    if not conversation:
                        continue
                    # Find recipient
                    if conversation.user1_id == current_user_id:
                        recipient_id = conversation.user2_id
                    else:
                        recipient_id = conversation.user1_id
                    # Delete from database
                    db.delete(message)
                    db.commit()
                    delete_data = {
                        "type": "message_deleted",
                        "message_id": message_id,
                        "conversation_id": conversation_id
                    }
                    # Notify recipient
                    await manager.send_personal_message(
                        delete_data,
                        recipient_id
                    )
                    # Notify sender
                    await manager.send_personal_message(
                        delete_data,
                        current_user_id
                    )
                finally:
                    db.close()
                continue
            # ==================================================
            # CHAT MESSAGE
            # ==================================================
            if message_type == "message":
                conversation_id = data.get(
                    "conversation_id"
                )
                content = data.get(
                    "content"
                )
                # Validate conversation ID
                if not conversation_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "conversation_id is required"
                    })
                    continue
                # Validate message
                if not content or not content.strip():
                    await websocket.send_json({
                        "type": "error",
                        "message": "Message cannot be empty"
                    })
                    continue
                db: Session = SessionLocal()
                try:
                    # Find conversation
                    conversation = (
                        db.query(models.Conversation)
                        .filter(
                            models.Conversation.id
                            == conversation_id
                        )
                        .first()
                    )
                    if not conversation:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Conversation not found"
                        })
                        continue
                    # Check membership
                    if current_user_id not in [
                        conversation.user1_id,
                        conversation.user2_id
                    ]:
                        await websocket.send_json({
                            "type": "error",
                            "message":
                                "You are not a member of this conversation"
                        })
                        continue
                    # Find recipient
                    if conversation.user1_id == current_user_id:
                        recipient_id = conversation.user2_id
                    else:
                        recipient_id = conversation.user1_id
                    # Create message
                    new_message = models.Message(
                        conversation_id=conversation_id,
                        sender_id=current_user_id,
                        content=content.strip()
                    )
                    # Save message
                    db.add(new_message)
                    db.commit()
                    db.refresh(new_message)
                    # Prepare message
                    message_data = {
                        "type": "message",
                        "id": new_message.id,
                        "conversation_id":
                            new_message.conversation_id,
                        "sender_id":
                            new_message.sender_id,
                        "content":
                            new_message.content,
                        "created_at":
                            new_message.created_at.isoformat()
                    }
                    # Send to recipient
                    await manager.send_personal_message(
                        message_data,
                        recipient_id
                    )
                    # Send back to sender
                    await manager.send_personal_message(
                        message_data,
                        current_user_id
                    )
                finally:
                    db.close()
                continue
    except WebSocketDisconnect:
        # Notify other users that this user is offline
        db: Session = SessionLocal()
        try:
            conversations = (
                db.query(models.Conversation)
                .filter(
                    (models.Conversation.user1_id == current_user_id)
                    |
                    (models.Conversation.user2_id == current_user_id)
                )
                .all()
            )
            for conversation in conversations:
                if conversation.user1_id == current_user_id:
                    recipient_id = conversation.user2_id
                else:
                    recipient_id = conversation.user1_id
                await manager.send_personal_message(
                    {
                        "type": "status",
                        "user_id": current_user_id,
                        "status": "offline"
                    },
                    recipient_id
                )
        finally:
            db.close()
        # Remove connection
        manager.disconnect(
            current_user_id
        )