import os

# Disable LangSmith tracing for OpenAI
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGCHAIN_TRACING"] = "false"

from openai import OpenAI
from state import AgentState
from memory import memory_store

client = OpenAI()


# ---------------- ANALYZE ----------------
def analyze_input(state: AgentState):
    prompt = f"""
    You are a strict English grammar checker.

    Analyze this sentence for grammar, spelling, and syntax errors ONLY:
    "{state['user_input']}"

    Rules for correction:
    - Fix only grammar, spelling, punctuation, and syntax mistakes.
    - Do NOT change the vocabulary, style, or meaning.
    - Do NOT rephrase or improve the sentence beyond what is strictly necessary.
    - If the sentence is already correct, return it unchanged with an empty errors list.

    Return JSON:
    {{
        "corrected": "the minimally corrected sentence, or the original if no errors",
        "errors": [
            {{
                "fragment": "the exact word or phrase from the original sentence that is wrong",
                "correction": "the corrected word or phrase that replaces it",
                "description": "brief factual explanation of why it is wrong"
            }}
        ]
    }}
    """

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    import json
    data = json.loads(res.choices[0].message.content)

    return {
        "corrected": data.get("corrected", ""),
        "errors": data.get("errors", []),
    }


# ---------------- RESPONSE ----------------
def generate_response(state: AgentState):
    if state["errors"]:
        prompt = f"""
        You are a friendly English tutor. Reply only to the current message below.
        Do not reference or continue any previous topic if not necessary.

        The user said: "{state['user_input']}"
        The corrected version is: "{state['corrected']}"

        then give a direct answer to what the user actually said. Then in separate paragraph(s) of 1-2 sentences: explain the specific grammar mistake, 
        """
    else:
        prompt = f"""
        You are a friendly English tutor. Reply only to the current message below.
        Do not reference or continue any previous topic if not necessary.

        The user said: "{state['user_input']}"

        Give a direct, concise answer to what the user said. Stay on topic.
        """

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )

    return {"response": res.choices[0].message.content}


# ---------------- MEMORY ----------------
def update_memory(state: AgentState):
    record = {
        "input": state["user_input"],
        "corrected": state["corrected"],
        "errors": state["errors"],
    }

    memory_store.add(record)

    history = memory_store.get_all()

    return {"history": history}