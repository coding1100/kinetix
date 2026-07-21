from fastapi import APIRouter

from app.api.v1 import auth, chat, home, invites, teams, workspaces

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(workspaces.router)
api_router.include_router(teams.router)
api_router.include_router(home.router)
api_router.include_router(chat.router)
api_router.include_router(invites.router)


@api_router.get("", tags=["meta"])
async def api_index():
    return {
        "version": "0.2.0-py",
        "phase": "PY-5-realtime",
        "runtime": "fastapi",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "auth": {
                "signup": "POST /api/v1/auth/signup",
                "login": "POST /api/v1/auth/login",
                "refresh": "POST /api/v1/auth/refresh",
                "logout": "POST /api/v1/auth/logout",
                "me": "GET /api/v1/auth/me",
            },
            "workspaces": {
                "list": "GET /api/v1/workspaces",
                "create": "POST /api/v1/workspaces",
                "get": "GET /api/v1/workspaces/{workspaceId}",
                "members": "GET /api/v1/workspaces/{workspaceId}/members",
                "invite": "POST /api/v1/workspaces/{workspaceId}/invites",
            },
            "invites": {
                "preview": "GET /api/v1/invites/{token}",
                "accept": "POST /api/v1/invites/{token}/accept",
                "acceptSignup": "POST /api/v1/invites/{token}/accept-signup",
            },
            "home": {
                "inbox": "GET /api/v1/workspaces/{workspaceId}/home/inbox",
                "tasks": "GET /api/v1/workspaces/{workspaceId}/tasks",
                "spaces": "GET /api/v1/workspaces/{workspaceId}/spaces",
                "posts": "GET|POST /api/v1/workspaces/{workspaceId}/posts",
                "sidebar": "GET|PATCH /api/v1/workspaces/{workspaceId}/home/sidebar",
            },
            "chat": {
                "channels": "GET|POST /api/v1/workspaces/{workspaceId}/chat/channels",
                "dms": "GET|POST /api/v1/workspaces/{workspaceId}/chat/dms",
                "messages": "GET|POST .../chat/channels/{channelId}/messages",
            },
            "realtime": {
                "socket": "Socket.IO at /socket.io (auth: access token)",
                "events": "workspace:join, chat:message",
            },
        },
    }
