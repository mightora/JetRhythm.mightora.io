# JetRhythm planning model and limitations

JetRhythm is an original, educational approximation of circadian phase adjustment. It is not a clinical decision-support tool and does not measure a person's internal biological phase. It was developed independently; no competitor's code, graphics, copy or proprietary planning algorithm is used.

## What the model uses

- Flight departure/arrival in airport-local wall time and IANA time zones. These are converted to UTC and account for daylight-saving changes.
- Self-reported usual bedtime and wake time, used as an approximation of biological night.
- Estimated core body-temperature minimum (CBTmin) at about three hours before habitual biological waking. Actual CBTmin varies considerably.
- The difference between origin and destination UTC offsets at arrival. The model uses the shorter of the clockwise/counter-clockwise shifts around a 24-hour clock.
- A selected *assumed* pace of 30, 45 or 60 minutes of phase change per day, with two preparation days and daily post-arrival estimates. This is not a biological prediction.
- Light-after-CBTmin windows for estimated phase advances and light-before-CBTmin windows for estimated phase delays. The displayed windows are simplified examples, not personalised phase-response curves or a substitute for specialist assessment.

## What the model does not know

JetRhythm has no measurement of dim-light melatonin onset, temperature minimum, habitual light exposure, sleep debt, illness, age-related responses, medications, chronotype, pregnancy, work restrictions or actual acclimatisation. A bedtime is not itself a reliable measure of an individual's circadian phase. Large time-zone crossings and unusual schedules may require a different strategy, sometimes including adjustment in the opposite direction. Light windows may fall in darkness or be impractical. The app does not promise recovery times or recommend medication dosing.

Flight-number entry is for identification only. No live flight-data lookup is active. Verify flights with your airline. In-flight sleep suggestions show overlaps with the destination's habitual night and are not optimised biological sleep prescriptions.

Use the plan as a starting point for travel conversations and personal planning. Preserve adequate sleep; do not drive or undertake hazardous work when sleepy. Speak with a qualified clinician about health concerns or melatonin. Do not follow light guidance if a clinician has advised against bright-light exposure.

## Primary research and guidance

1. [CDC Yellow Book: Jet Lag Disorder](https://www.cdc.gov/yellow-book/hcp/travel-air-sea/jet-lag-disorder.html). Light timing, pre-travel schedule adjustment and limitations of generic advice.
2. [Eastman CI, Burgess HJ. How to travel the world without jet lag. Sleep Medicine Clinics, 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC2829880/).
3. [St Hilaire MA et al. Human phase response curve to a 1 h pulse of bright white light. Journal of Physiology, 2012](https://pubmed.ncbi.nlm.nih.gov/22735537/).
4. [NHS: Jet lag](https://www.nhs.uk/conditions/jet-lag/).

Version: `jetrhythm educational phase-response approximation v1`. Any future claim of clinical validation would require a separate evidence review and independent evaluation.
