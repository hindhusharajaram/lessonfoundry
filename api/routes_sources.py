from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from api.deps import require_teacher
from db.database import get_db

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("/upload")
def upload_source(
    title: str = Form(...),
    text: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    return {"message": "Source upload endpoint initialized", "title": title}


@router.get("/{source_id}/versions")
def get_source_versions(
    source_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    return {"source_id": source_id, "versions": []}
