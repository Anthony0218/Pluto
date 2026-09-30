# Eat It asset provenance and commercial release notes

Scope: this Eat It 3D change, reviewed 2026-09-28. This records implementation provenance and license notices, not legal clearance or a guarantee against claims.

## Assets used by the arena

- `models.ts`: newly authored procedural primitive meshes. The cars, trucks, tractors, furniture, food, vegetation and buildings are generic forms built in code. No downloaded models, textures, branded vehicle designs, logos or third-party characters were introduced.
- `renderer.ts`: a custom ring creature, lighting, shadows, camera and ground-opening rendering. Uses the project's existing Three.js dependency, under MIT. No new runtime package was installed for this change.
- `terrain.ts`: locally drawn map ground textures, extracted from the existing Eat It renderer. It does not download image textures. Raised scenery is rendered as meshes.
- `audio.ts`: the existing synthesized Web Audio sounds and ambience; this change adds no sound recordings or music samples.
- `public/images/eat-it.svg`: the existing local menu illustration, left intact. It contains inline vector paths, gradients and local symbol references. Its original creation history was not independently verified by this change.
- The HUD reuses React, Lucide icons and the existing Geist font. Their upstream license texts, along with Three.js and the direct routing/network UI dependencies, are shipped in `public/licenses/eat-it-third-party.txt`. Vite copies this file into the release's `/licenses/` directory. Preserve these notices and upstream obligations in distributions.

## What this does and does not establish

The implementation deliberately avoids copying a specific game's artwork, character designs, levels, music, branding or vehicle badges. Procedural construction documents where these meshes came from; it cannot prove that no similar design or third-party right exists.

Commercial use of OpenAI output remains subject to the applicable account terms. OpenAI's Europe Terms assign its rights, if any, in output to the user, to the extent permitted by law; they also say output may not be unique and the user remains responsible for respecting others' rights. Ownership as between you and OpenAI is not a non-infringement guarantee. Source: https://openai.com/policies/eu-terms-of-use/ (Content section, accessed 2026-09-28). Other account/service terms may apply.

AI assistance does not by itself settle whether every output is protectable copyright. For example, the US Copyright Office's 2025 report says sufficient human authorship matters. This is a US source, not a conclusion about German/EU law: https://www.copyright.gov/newsnet/2025/1060.html .

The name “Eat It” has not received a trademark clearance search. No patent, trade-dress, trademark, or comprehensive similarity review was performed. The rest of this multi-game application and its transitive dependency tree were not audited here; these notices do not clear those separate assets and packages for commercial distribution. Before commercial publication, obtain an IP review of the final game, title, marketing and full shipped dependency/asset inventory in the intended markets.
