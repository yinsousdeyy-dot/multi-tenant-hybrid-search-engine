from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Embedding Service")
model = SentenceTransformer("all-MiniLM-L6-v2")

class Payload(BaseModel):
    text: str

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/embed")
async def embed(payload: Payload):
    vector = model.encode(payload.text).tolist()
    return {"embedding": vector}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
