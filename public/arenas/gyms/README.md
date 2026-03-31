# Arena Background Images

Drop Game Boy–style gym images here. One image per arena.

## File Names (exact — used by RoomSelect)

| File name               | Arena         | Gym Leader  |
|-------------------------|---------------|-------------|
| `pewter-city.png`       | Pewter City   | Brock       |
| `cerulean-city.png`     | Cerulean City | Misty       |
| `vermilion-city.png`    | Vermilion City| Lt. Surge   |
| `celadon-city.png`      | Celadon City  | Erika       |
| `fuchsia-city.png`      | Fuchsia City  | Koga        |
| `saffron-city.png`      | Saffron City  | Sabrina     |
| `cinnabar-island.png`   | Cinnabar Island | Blaine    |
| `viridian-city.png`     | Viridian City | Giovanni    |

## How to replace

1. Drop your new image into this folder with the exact filename above.
2. No code changes needed — the UI reads directly from `/arenas/gyms/<arena-id>.png`.

## Tips

- Any resolution works; images are displayed with `background-size: cover`.
- A dark overlay is automatically applied on top for text readability.
- PNG or JPG both work fine.
- Pre-populated with copies of the existing gym art as placeholders.
