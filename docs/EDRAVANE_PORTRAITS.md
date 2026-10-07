# Edravane character portraits

Generated with the built-in `image_gen.imagegen` tool on 7 October 2026.
Eight painted character atlases contain 15 portraits each, covering the ruler and
two adult heirs in all 40 starting houses (120 character cells).

Final game assets are saved in
`public/MedievalKingdoms/edravane/portraits/`: `auremarch.jpg`,
`high-cairn.jpg`, `saltmere.jpg`, `dunwald.jpg`, `varnesk.jpg`,
`sylvarenne.jpg`, `ilyr-coast.jpg`, and `graskor.jpg`.
The original generated PNGs were encoded as JPEGs at quality 85 for delivery,
without altering the artwork.

The complete final prompt set and asset mapping are recorded in
[manifest.json](../public/MedievalKingdoms/edravane/portraits/manifest.json).
Each atlas is a three-column, five-row grid. Rows follow the original house
index; columns contain the original ruler, female heir, and male heir.
The portraits match the characters' recorded genders rather than inferred names.

Portrait selection follows the original person ID, so a promoted heir retains
their face. Marriage, captivity, age updates, house navigation, and save/reload
also keep that identity. The current ruler receives a separate crown badge.
Deceased dynasty members retain their portrait in greyscale.

The house sidebar and dynasty panel share the portrait component. Additional
custom identities use a deterministic portrait from their house's culture and
recorded gender. Portraits are a static starting-age depiction; they do not
visually age as campaign years advance.
