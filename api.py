from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from app.models import EntryConfig, KnockoutPick, MatchResult
from app.service import score_single_entry


class PredictionIn(BaseModel):
    match_id: str
    home_score: int
    away_score: int


class KnockoutPickIn(BaseModel):
    round_name: str
    slot_id: str
    winner_team: str


class EntryIn(BaseModel):
    entry_name: str
    predictions: List[PredictionIn]
    knockout_picks: List[KnockoutPickIn] | None = None


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
        knockout_picks=[
            KnockoutPick(
                round_name=pick.round_name,
                slot_id=pick.slot_id,
                winner_team=pick.winner_team,
            )
            for pick in entry_in.knockout_picks
        ]
        if entry_in.knockout_picks
        else None,
    )

    return score_single_entry(entry)
