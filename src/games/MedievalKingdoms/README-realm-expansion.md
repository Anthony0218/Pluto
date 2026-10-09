# Edravane: realms, resources and promises

The expansion connects personal rule, provincial development, resource exchange and territorial strategy through the same authoritative command engine used by solo and multiplayer campaigns.

## Playable systems

- **Compacts:** crowns propose coins and any combination of the eight goods, with two to eight deliveries. The recipient accepts, declines or prepares a counteroffer on their turn. Acceptance exchanges the first cargo atomically; subsequent deliveries occur once on the sender's own turn. Covenants grant reciprocal military access, reduced tolls, protection of trade or support for the sender's heir. No stock is reserved by an unaccepted offer. Shortages, withdrawal and war end promises; successful completion improves relations. Recipient store capacity is enforced.
- **Common works:** a river bridge, winter granary or protected route between ports pools actual contributions from peaceful crowns. Cancellation refunds unfinished funding. Completed works require upkeep from the founder, and benefits require maintained, open access. Closing contributor access harms relations. Granaries support supply and winter reserves; bridges increase output; sea lanes reduce matching contributor route costs and storm risk.
- **Regional economies:** every crown has one specialist export with 15% extra automatic output. Grain subsistence preserves survival options. The economy panel identifies resource dependencies and prices. Farm, market and town investment adds visible development and 10% production per level, up to three.
- **Domestic interests:** rural communities, merchants, and schools/healers have approval and four alternative governing reforms. Mobilisation reduces rural approval and farm productivity. Low rural approval increases unrest; low merchant approval raises route costs; low scholarly approval reduces legitimacy. Reforms trade revenue, route expense, patronage and noble opinion against each other.
- **Conquest charters:** retained local rule, a loyal vassal governor, autonomy and direct integration set output, initial unrest, administrator and administrative pressure separately from crown ownership. Occupation must be held for three ticks by a host before the first charter. A crown can revise its integrated estate's charter for 50 coins; autonomy relieves administrative pressure and 15 existing unrest.
- **Political memory:** individuals remember fulfilled agreements, withdrawals, shared works and local concessions. Bilateral memories and contract terms are private to involved crowns in multiplayer projections. When responsibility is known, legacy penalties fall on the house breaking its commitment.
- **Strategic geography:** connected holdings, river crossings, harbours and mountain passes contribute to defence objectives. Pass castles receive a defence bonus; joint projects materially affect supply, local production and transport.
- **Campaign formats:** a council chronicle lasts 48 full rounds, with a succession council beginning midway. Recognised heirs succeed once; disputed or missing heirs require resolution before their council can complete. Dynasty, prosperity, diplomacy and defence each score at most 25. The highest total wins after battles and reactions resolve; ties share victory. Completed solo chronicles can continue as a sandbox. Existing saves migrate into an open sandbox.

## Interface

The realm desk starts with decisions and shows consequences before commitments. Separate agreements, projects, interests, relationships and legacy panels expose the mechanics. Relationship map labels are clickable and keyboard accessible. World, regional and estate scales show progressively more detail: terrain relief, cultivation, growing towns, ports, caravans and landmarks. Desktop navigation shows every section; mobile preserves map space through a compact, expandable desk. A year now has twelve rounds, with four three-round seasons and a shared calendar for age and birth progression.

## Compatibility and verification

The optional versioned agreements ledger preserves older troop, treasury, district and battle records. Imports validate contribution totals, deliveries, references, development, approvals, memories, scoring and calendar fields. New commands use existing turn authority, rollback on failure, and shared server handling. Bots answer offers and contribute to projects.

Run `npm run check:edravane` and `npm run test:edravane`. The agreements suite covers consent, conservation, once-per-turn delivery, default, privacy, refunds, upkeep, access, reform costs, development, conquest administration, calendar migration, succession, campaign completion, save rejection and bot decisions. Browser verification covers desktop/mobile layouts, accepted and declined trades, actual project funding and relationship inspection. Longer-term balance and human multiplayer playtesting remain useful before release.

## Original presentation and asset records

The added map relief, farm plots, buildings, ship/caravan marks, project markers, relationship lines and seal/manuscript styling are authored in SVG and CSS. The expansion adds no art, logos, terminology, copied interface assets or rulebook text taken from the commercial reference games. Existing Lucide icons remain in use under the project's existing dependency notices.

This does not certify rights to pre-existing media. `public/licenses/media-provenance.txt` and `docs/COPYRIGHT_REVIEW.md` document incomplete provenance for existing MedievalKingdoms map and ring textures; those records still require resolution for release.
