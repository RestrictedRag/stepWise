# Persistent FastAPI Forced Aligner Microservice
import asyncio
import base64
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from align_engine import ForcedAlignerEngine

app = FastAPI(title="StepWise MMS_FA Aligner Service")
engine: Optional[ForcedAlignerEngine] = None
semaphore = asyncio.Semaphore(2) # Bounded worker concurrency

class AlignRequest(BaseModel):
    tokens: List[str]
    audio_base64: str
    lang: str = "en"

class SpeechMarkDTO(BaseModel):
    word_index: int
    value: str
    start_ms: int
    end_ms: int
    confidence: float

class AlignResponse(BaseModel):
    timing_source: str
    alignment_confidence: float
    marks: List[SpeechMarkDTO]

@app.on_event("startup")
async def startup_event():
    global engine
    engine = ForcedAlignerEngine()

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "MMS_FA",
        "engine_ready": engine is not None,
    }

@app.post("/align", response_model=AlignResponse)
async def align_endpoint(req: AlignRequest):
    if not engine:
        raise HTTPException(status_code=503, detail="Aligner engine not initialized.")

    if not req.tokens:
        return AlignResponse(timing_source="forced_alignment", alignment_confidence=1.0, marks=[])

    async with semaphore:
        try:
            audio_bytes = base64.b64decode(req.audio_base64)
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, engine.align, req.tokens, audio_bytes, req.lang)
            return AlignResponse(**result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Alignment processing error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("align_server:app", host="127.0.0.1", port=8010, log_level="info")
