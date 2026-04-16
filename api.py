from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from app.models import EntryConfig, KnockoutPick, MatchResult
from app.knockout import ThirdPlaceAdvancementTiebreakRequired
from app.service import generate_knockout_bracket_preview, score_single_entry
from app.validator import ValidationError


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
    advancing_third_place_groups: List[str] | None = None
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
    entry = parse_entry(entry_in)

    try:
        return score_single_entry(entry)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ThirdPlaceAdvancementTiebreakRequired as error:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "manual_third_place_tiebreak_required",
                "message": str(error),
                "locked_group_ids": error.locked_group_ids,
                "candidate_group_ids": error.candidate_group_ids,
                "slots_remaining": error.slots_remaining,
            },
        ) from error


@app.post("/api/generate-knockout-bracket")
def generate_knockout_bracket_endpoint(entry_in: EntryIn):
    entry = parse_entry(entry_in)

    try:
        return generate_knockout_bracket_preview(entry)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ThirdPlaceAdvancementTiebreakRequired as error:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "manual_third_place_tiebreak_required",
                "message": str(error),
                "locked_group_ids": error.locked_group_ids,
                "candidate_group_ids": error.candidate_group_ids,
                "slots_remaining": error.slots_remaining,
            },
        ) from error


def parse_entry(entry_in: EntryIn) -> EntryConfig:
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
        advancing_third_place_groups=entry_in.advancing_third_place_groups,
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

    return entry
