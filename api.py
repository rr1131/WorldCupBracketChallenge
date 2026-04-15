from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from app.models import EntryConfig, MatchResult
from app.service import score_single_entry


class PredictionIn(BaseModel):
    match_id: str
    home_score: int
    away_score: int


class EntryIn(BaseModel):
    entry_name: str
    predictions: List[PredictionIn]


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/score-entry")
def score_entry_endpoint(entry_in: EntryIn):
    entry = EntryConfig(
        entry_name=entry_in.entry_name,
        predictions={
            p.match_id: MatchResult(
                match_id=p.match_id,
                home_score=p.home_score,
                away_score=p.away_score,
            )
            for p in entry_in.predictions
        },
    )

    return score_single_entry(entry)