# 09 — Journey Reliability and Delay

## Disclaimer
Display this exact text wherever reliability is shown:

`Illustrative prototype reliability score. Not a statistically validated probability.`

## Score
Range 0–100; higher means more favourable under the prototype assumptions.

## Factors
- Expected delay.
- Event impact.
- Transfer waiting time.
- Connection buffer.
- Bus availability.
- Number of transfers.
- Active route disruptions.

Use documented normalisation and penalty caps. Example maximum penalties:
- Delay 25.
- Event impact 20.
- Transfer waiting 15.
- Connection-buffer risk 15.
- Bus availability 15.
- Transfer count 10.
Total maximum penalty 100.

`score = clamp(100 - sum(normalisedPenalties), 0, 100)`

Do not subtract raw minutes from a percentage without defining conversion. Avoid counting the same event delay both as full delay penalty and repeated disruption penalty.

## Display
Score, expected departure, recommended departure, expected arrival, required arrival, estimated delay, risk factors, and alternatives.

Example descriptive labels (configurable): 80–100 High, 60–79 Moderate, 40–59 Low, 0–39 Very Low. These are prototype categories, not standards.

## Recalculation
Recalculate after event edits, road closure, incident confirmation, bus status/assignment change, replacement approval, timetable change, or reset.
