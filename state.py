from typing import TypedDict, List, Dict


class AgentState(TypedDict):
    user_input: str
    response: str
    corrected: str
    errors: List[Dict]
    history: List[Dict]