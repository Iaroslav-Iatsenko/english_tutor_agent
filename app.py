# app.py
from dotenv import load_dotenv
import langsmith as ls
import os

# === Load environment variables first ===
load_dotenv()
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGCHAIN_PROJECT"] = ""


# === Import graph after env is loaded ===
from graph import build_graph

# === Build your graph ===
graph = build_graph()


def chat():
    print("🧠 English Tutor Agent (type 'exit' to quit)\n")

    state = {
        "history": []
    }

    while True:
        user_input = input("You: ")

        if user_input.lower() == "exit":
            break

        state["user_input"] = user_input

        # graph.invoke automatically uses LANGCHAIN_API_KEY + LANGCHAIN_API_BASE
        with ls.tracing_context(enabled=False):
           result = graph.invoke(state)
        

        print("\nAgent:", result.get("response", ""))

        if result.get("errors"):
            print("⚠️ Mistakes detected:")
            for err in result["errors"]:
                print("-", err)

        print("\n---\n")
        state = result  # carry forward state


if __name__ == "__main__":
    chat()