"""Fail the build for untraceable facts, dates, or stale/invalid verification metadata."""
import json
import re
from datetime import date
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def verify(data):
    errors = []
    for key, source in data['sources'].items():
        if source.get('status') != 'verified' or not source.get('url','').startswith('https://'):
            errors.append(f'{key}: source and verified status required')
        try:
            date.fromisoformat(source['retrieved'])
        except (KeyError, ValueError, TypeError):
            errors.append(f'{key}: valid retrieval date required')
    for key, fact in data['facts'].items():
        if not fact.get('text') or fact.get('source') not in data['sources']:
            errors.append(f'{key}: fact has no traceable source')
    for story in data['stories']:
        refs = story['factIds'] + [f for p in story['pages'] for f in p['factIds']]
        for ref in refs:
            if ref not in data['facts']:
                errors.append(f'{story["id"]}: missing fact {ref}')
        if not story['factIds']:
            errors.append(f'{story["id"]}: no evidence')
        year_fact = data['facts'].get(story.get('yearFact',''),{})
        if story['year'] not in year_fact.get('text',''):
            errors.append(f'{story["id"]}: display year has no supporting fact reference')
        for page in story['pages']:
            if re.search(r'\d',page['body']):
                errors.append(f'{story["id"]}: narrative numbers must be displayed through fact references')
    return errors
if __name__ == '__main__':
    errors = verify(json.loads((ROOT/'shared/content.json').read_text(encoding='utf-8')))
    ephemeris=json.loads((ROOT/'shared/ephemeris.json').read_text(encoding='utf-8'))
    if ephemeris.get('status')!='verified':errors.append('Ephemeris snapshot verification required')
    date.fromisoformat(ephemeris['retrieved'])
    for key,target in ephemeris['targets'].items():
        if not target.get('source','').startswith('https://ssd.jpl.nasa.gov/') or not target.get('samples'):
            errors.append(f'{key}: no JPL snapshot provenance')
        for sample in target.get('samples',[]):
            if sample['distanceKm']<=0 or sample['downlinkMinutes']<=0:errors.append(f'{key}: invalid range or time')
    physics=json.loads((ROOT/'shared/physics.json').read_text())
    for key,record in physics['sourceRecords'].items():
        if record.get('status')!='verified' or not record.get('retrieved') or not record.get('url'):errors.append(f'{key}: physics provenance required')
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Fact gate passed: all facts have a source, retrieval date, and verified status. Human verification remains required.')
