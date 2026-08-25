# The Villager — Clean Rebuild

Mobile-first low-poly third-person survival/building game.

The previous prototype is preserved on `archive/prototype-0.7.2`.

## Core architecture
- Third-person camera-relative movement
- Island world with ocean as natural boundary
- Chunk-streamed terrain/resources/foliage
- Physical tree -> fallen tree -> logs harvesting pipeline
- Carry/place physical logs
- Free-form structural construction
- Authoritative terrain height service
- Persistent world/resource/construction state

This branch intentionally starts small. Systems are added behind stable boundaries rather than compatibility wrappers.
