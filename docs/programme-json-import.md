# Programme JSON import

VicGym uses the Coach Review paste, validate, preview, and explicit-confirmation workflow for all programme changes. It does not provide a manual programme editor.

## Initial programme creation

Use `schemaVersion: 2` once. The server assigns programme version 1, validates every exercise against the active catalogue, and creates and activates the programme only after the preview is explicitly confirmed.

```json
{
  "schemaVersion": 2,
  "operation": "create-programme",
  "program": { "slug": "small-gym", "name": "Small Gym Programme" },
  "days": [
    {
      "slug": "upper-a",
      "name": "Upper A",
      "rotationOrder": 1,
      "exercises": [
        {
          "exercise": "chest-press",
          "sets": 3,
          "targetReps": 12,
          "load": { "type": "machineLevel", "value": 8 },
          "restSeconds": 120,
          "autoRest": true,
          "position": 1
        },
        {
          "exercise": "one-arm-dumbbell-row",
          "sets": 3,
          "targetReps": 12,
          "load": { "type": "kg", "value": 10 },
          "restSeconds": 120,
          "autoRest": true,
          "position": 2
        }
      ]
    }
  ]
}
```

Initial creation is rejected when a real programme already exists. Programme JSON never creates catalogue exercises.

## Weekly changes

Continue using the backwards-compatible `schemaVersion: 1` patch document with the exact active programme slug and base version supplied by the weekly report. A confirmed patch creates the next immutable version of the same programme. Historical sessions remain attached to the version on which they were performed.

Use `load.type: "machineLevel"` for selector levels and `load.type: "kg"` for kilogram exercises. Legacy `weightKg` remains accepted only for kilogram catalogue exercises. VicGym rejects mismatched types and rejects documents that provide both `load` and `weightKg` for the same change.
