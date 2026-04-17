from typing import TypedDict, List, Dict


class AgentState(TypedDict):
    user_input: str
    response: str
    corrected: str
    errors: List[str]
    history: List[Dict]