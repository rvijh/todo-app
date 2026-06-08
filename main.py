"""
FastAPI backend for the To-Do application.
Connects to Supabase for persistent data storage.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional

# Load environment variables from .env file
load_dotenv()

# --- Supabase Client Initialization ---
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_KEY must be set in your .env file. "
        "Copy .env.example to .env and fill in your credentials."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- FastAPI App Setup ---
app = FastAPI(
    title="Todo API",
    description="A simple CRUD API for managing to-do items backed by Supabase.",
    version="1.0.0",
)

# Enable CORS so the frontend (served from a different origin) can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Restrict to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class TodoCreate(BaseModel):
    """Payload for creating a new to-do item."""
    task: str

class TodoUpdate(BaseModel):
    """Payload for updating an existing to-do item."""
    task: str

# --- Routes ---

@app.get("/todos", summary="Retrieve all to-do items")
async def get_todos():
    """
    Fetch every row from the 'todos' table, ordered by creation time (newest first).
    Returns a list of todo objects.
    """
    try:
        response = supabase.table("todos").select("*").order("created_at", desc=True).execute()
        return {"todos": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch todos: {str(e)}")


@app.post("/todos", status_code=201, summary="Create a new to-do item")
async def create_todo(todo: TodoCreate):
    """
    Insert a new row into the 'todos' table.
    Requires a non-empty 'task' string in the request body.
    """
    task = todo.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="Task cannot be empty.")

    try:
        response = supabase.table("todos").insert({"task": task}).execute()
        return {"todo": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create todo: {str(e)}")


@app.put("/todos/{todo_id}", summary="Update an existing to-do item")
async def update_todo(todo_id: int, todo: TodoUpdate):
    """
    Update the 'task' field of the row with the given ID.
    Returns 404 if no matching record is found.
    """
    task = todo.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="Task cannot be empty.")

    try:
        response = (
            supabase.table("todos")
            .update({"task": task})
            .eq("id", todo_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Todo with id={todo_id} not found.")
        return {"todo": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update todo: {str(e)}")


@app.delete("/todos/{todo_id}", status_code=200, summary="Delete a to-do item")
async def delete_todo(todo_id: int):
    """
    Delete the row with the given ID from the 'todos' table.
    Returns 404 if no matching record is found.
    """
    try:
        response = (
            supabase.table("todos")
            .delete()
            .eq("id", todo_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Todo with id={todo_id} not found.")
        return {"message": f"Todo {todo_id} deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete todo: {str(e)}")


@app.get("/health", summary="Health check")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
