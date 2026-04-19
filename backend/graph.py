from langgraph.graph import StateGraph
from state import AgentState
from nodes import analyze_input, generate_response, update_memory


def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("analyze", analyze_input)
    builder.add_node("respond", generate_response)
    builder.add_node("memory", update_memory)

    builder.set_entry_point("analyze")

    builder.add_edge("analyze", "respond")
    builder.add_edge("respond", "memory")

    return builder.compile(debug=False)