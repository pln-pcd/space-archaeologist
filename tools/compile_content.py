"""Validate authored YAML and emit the one canonical text version for the web."""
from pathlib import Path
import json
from typing import Literal
import yaml
from pydantic import BaseModel, Field, HttpUrl

ROOT = Path(__file__).resolve().parents[1]
class Source(BaseModel):
    title: str
    url: HttpUrl
    retrieved: str
    status: Literal['verified']
class Fact(BaseModel):
    text: str
    source: str
class Page(BaseModel):
    title: str
    body: str
    action: Literal['wake', 'read', 'game', 'choice']
    choices: list[str] = []
    factIds: list[str]
class Story(BaseModel):
    id: str
    stage: str
    title: str
    machine: str
    subtitle: str
    location: str
    year: str
    yearFact: str
    color: str
    type: Literal['lander', 'rover', 'probe', 'viking', 'voyager']
    badge: str
    game: Literal['landing', 'solar', 'signal']
    factIds: list[str]
    pages: list[Page] = Field(min_length=5)
class Content(BaseModel):
    sources: dict[str, Source]
    facts: dict[str, Fact]
    stories: list[Story]

def compile_content():
    content = Content.model_validate(yaml.safe_load((ROOT/'content/stories.yaml').read_text(encoding='utf-8')))
    (ROOT/'shared/content.json').write_text(content.model_dump_json(indent=2), encoding='utf-8')
    print(f'Compiled {len(content.stories)} validated storybooks.')
    return content
if __name__ == '__main__':
    compile_content()
