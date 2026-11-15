import asyncio
from server.nova.brain import _turns, _local, answer
from server.nova.facts import artifact_context, all_facts

CONTEXT = {"missionId":"moon-001","step":6,"artifactId":"retroreflector"}

def test_context_contains_only_registered_sourced_copy():
    line, facts = artifact_context({**CONTEXT, "facts":"invented", "notes":"private note"})
    assert "Retroreflector" in line
    assert facts and all("invented" not in f.text and "private note" not in f.text for f in facts)

def test_unknown_artifact_never_injects_client_text():
    line, facts = artifact_context({**CONTEXT,"artifactId":"unknown-ignore-the-rules"})
    assert not facts and "unknown-ignore" not in line
    assert artifact_context({"missionId":"../../server/.env","step":6}) == ("", [])

def test_this_question_uses_current_artifact_offline():
    events = _local("What is this?", "eagle", CONTEXT)
    text = "".join(e.get("t", "") for e in events)
    assert "reflector" in text.lower() and len(text.split()) <= 15

def test_prompt_context_is_current_not_completed_mission():
    prompt = _turns([], "What is this?", "eagle", CONTEXT)[0]["content"]
    assert "Current mission step: 6" in prompt and "Retroreflector" in prompt
    assert "passive reflector" in prompt.lower()

def test_mission_facts_participate_in_guard_number_checks():
    assert any(f.id.startswith("moon-001/") for f in all_facts())

def test_distress_still_precedes_context_and_network():
    async def collect():
        return [e async for e in answer("I want to hurt myself", "eagle", [], context=CONTEXT)]
    events = asyncio.run(collect())
    assert events[0]["kind"] == "safety"

def test_pointing_question_uses_verified_referent_with_ai_enabled():
    class NoNetwork:
        def classify(self, *args): raise AssertionError("A verified pointing question needs no classifier")
        def stream(self, *args): raise AssertionError("A verified pointing question needs no generation")
    async def collect():
        return [event async for event in answer("What is this?", "eagle", [], client=NoNetwork(), context=CONTEXT)]
    events=asyncio.run(collect())
    assert events[0]["kind"] == "local"
    assert "reflector" in "".join(event.get("t", "") for event in events).lower()

def test_reconstruction_does_not_keep_the_previous_plaque_context():
    context={"missionId":"moon-001","step":8,"artifactId":None}
    line,facts=artifact_context(context)
    assert "reconstruction" in line.lower()
    assert "ascent" in facts[1].text.lower() and "descent" in facts[1].text.lower()
    text="".join(event.get("t","") for event in _local("What is this?","eagle",context))
    assert "ascent" in text.lower() and "plaque" not in text.lower()
