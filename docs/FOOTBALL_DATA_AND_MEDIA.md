# Football data and visual rights

Research date: 6 October 2026. This document records the choices made for the
Learn milestones 10–13, including the user's requirement to use official logos
only when the necessary usage rights are established.

## What ships

All pitch diagrams, player markers, animations, score diagrams, and teaching
melodies are authored for this app. Playback uses Web Audio oscillators; there
are no sampled recordings, copied sheet music, photos, match clips, official
crests, competition emblems, or trophy likenesses. Club and competition names
appear as plain identifying text, without claiming sponsorship or affiliation.

## Official logos are not cleared

Public visibility, a downloadable SVG, or an educational purpose does not by
itself establish permission for this app to reuse an official logo. The sources
checked do not provide a blanket licence for the planned use:

- [UEFA Champions League 2026/27, Article 12](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-12-Intellectual-property-rights-Online)
  reserves the competition's intellectual property, including logos, identities,
  trophies and other media, to UEFA.
- [UEFA platform terms](https://www.uefa.com/termsconditions/) describe ownership
  and restrictions on copying platform content.
- [FIFA brand protection](https://rusecure.fifa.com/tournament-organisation/brand-protection)
  explains protection of official tournament branding by copyright, trademark,
  and other laws.
- [Arsenal's website terms](https://www.arsenal.com/terms-and-conditions-of-use)
  are a concrete club example requiring prior written consent for its marks.
  One club's permissions do not apply to other clubs.

The implementation therefore excludes official logos. Attribution alone is not
permission. A freely licensed copy of an image may also leave trademark rights
unresolved; Wikimedia hosting is not blanket clearance. No jurisdiction-specific
copyright exception or fair-use assumption was used to approve an asset.

Before adding official branding, retain an asset-specific written licence or
permission that covers the exact app, commercial/public use, reproduction,
modification, territories and term, and satisfies any separate trademark
conditions. Record the owner, source file, grant, attribution, restrictions and
expiry in the repository. Legal review may be needed for the actual release and
jurisdictions; this research is not a guarantee of freedom from claims.

## Permission is possible; it has not been established here

The absence of official symbols does not mean they can never be used legally.
A rights holder can grant a licence or written permission covering the app's
actual use. FIFA's [Legal/Branding/Rights FAQ](https://vod.fifa.com/organisation/contact-fifa/legal-branding-and-rights)
explicitly directs mark-use requests to its Mark Request Form. The same FAQ
separates limited editorial use of text/statistics from protected images/logos;
one permission does not establish the other. UEFA's [terms](https://www.uefa.com/termsconditions/)
identify protected marks and do not grant a general reuse licence.

The football category chooser uses the generic Trophy, Shield, Users and List
icons from the app's existing Lucide library, not official tournament symbols.
No permission request was submitted, and no asset licence was obtained in this
session. Approved assets can be introduced once their grants are recorded.

## Match laws

Teaching text is an original beginner paraphrase of
[IFAB Laws of the Game 2026/27](https://www.theifab.com/documents/?documentCategory=lawsofthegame).
The visible edition is pinned in the app; current web reference pages may later
change edition. In particular:

- [Law 11](https://www.theifab.com/laws/latest/offside/) supports pass-time position,
  the ball and second-last opponent, level/own-half boundaries, involvement,
  direct-restart exceptions, and deliberate play versus deflection/save.
- [Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/) supports force
  categories, handling, discipline and the eight-second goalkeeper restriction.
- [Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/),
  [Law 14](https://www.theifab.com/laws/latest/the-penalty-kick/) and
  [Law 16](https://www.theifab.com/laws/latest/the-goal-kick/) support the related
  duration, penalty and restart explanations.

The offside model uses x coordinates of the foremost eligible body points and
attacks towards x=100. It is a teaching abstraction, not automated officiating.
It takes involvement and opponent control/save as stated scenario inputs;
video geometry alone cannot establish these judgements. Tactical shapes are
illustrative and are not laws or exact models of a real club.

## Trophy snapshots and counting

`src/data/footballHonours.ts` contains nine selected men's clubs across the six
requested domestic leagues, with club totals through **2024/25**. These are
historical teaching snapshots, not up-to-date standings or every club's history.
Counts group European Cup with Champions League and UEFA Cup with Europa League.
They separately display the main domestic cup and Conference League. Omitted
categories are not folded into an overall total. A displayed zero means no win
in that category through the cutoff, not missing data.

Every club record has primary source links:

| Club | Main source and counting note |
| --- | --- |
| Bayern München | [Club honours](https://fcbayern.com/en/club/honours), [dated 2025 Bundesliga report](https://www.bundesliga.com/de/bundesliga/news/fc-bayern-munchen-zahlen-rekorde-fakten-meisterschaft-31878). 33 Bundesliga titles excludes 1932; cup wins after the cutoff are excluded. |
| Liverpool | [Club honours](https://www.liverpoolfc.com/history/honours). 20 English top-flight titles includes 18 First Division and two Premier League titles. |
| Real Madrid | [Official trophy history](https://www.realmadrid.com/en-US/the-club/historia/futbol/primer-equipo-masculino/trofeos). |
| Juventus | [Lega Serie A honours](https://www.legaseriea.it/team/juventus/palmares), [2024 cup report](https://www.juventus.com/en/news/articles/all-the-records-from-rome). Uses the league's 36 recognised championships. |
| Paris Saint-Germain | [Dated 2025 domestic honours](https://news.psg.fr/communiques-de-presse/equipe-premiere/une-16e-coupe-de-france-pour-le-paris-saint-germain), [2025 Champions League season](https://www.uefa.com/uefachampionsleague/history/seasons/2025/). Later seasons are excluded. |
| Benfica | [Club honours](https://www.slbenfica.pt/pt-pt/instituicao/clube/palmares). Taça de Portugal is distinct from the former Campeonato de Portugal. |
| Chelsea | [Club trophy cabinet](https://www.chelseafc.com/en/trophy-cabinet), [2025 European trophy history](https://www.chelseafc.com/en/news/article/weve-won-it-all-again-chelseas-european-trophy-cabinet). |
| Sevilla | [Club honours](https://sevillafc.es/el-club/palmares), [UEFA seven winning seasons](https://www.uefa.com/uefaeuropaleague/news/0278-15f537b7c75c-39eb83ca154a-1000--meet-the-winners-sevilla/). |
| Roma | [Club honours](https://www.asroma.com/en/club/history/honours). |

The national-team tables contain all winning nations and their winning years,
separately for men through **2026** and women through **2023**. Germany includes
West Germany. Sources: [FIFA men's championship history](https://www.fifa.com/en/tournaments/mens/worldcup/articles/world-cup-champions-1982-2026-italy-argentina-germany-brazil-france-spain),
[FIFA's simultaneous champions report](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/spain-men-women-first-simultaneous-champions),
and [UEFA women's winners and final results](https://www.uefa.com/womensworldcup/news/027a-166817b8be17-9e0082e122cd-1000--women-s-world-cup-groups-and-matches-netherlands-face-us-eng/).

This is a small manually authored set of historical facts with provenance links,
not a copied provider database, scraped feed or redistributed site media. A future
bulk/live data integration needs an explicit provider licence and refresh policy.
When refreshing, change the cutoff labels and records together, verify winning
years against the organiser, update this provenance record, and run the tests.

## Music references

Notation and instrument explanations use original text and score drawings.
Reference material includes [Yamaha's instrument guide](https://www.yamaha.com/en/musical_instrument_guide/),
[clarinet structure](https://www.yamaha.com/en/musical_instrument_guide/clarinet/mechanism/mechanism005.html)
and [reading guitar notation and TAB](https://hub.yamaha.com/guitars/g-how-to/a-guitarists-guide-to-reading-sheet-music-and-tablature/).
No reference images, scores or audio are bundled. International A–G names,
scientific octave numbering, equal temperament and A4 = 440 Hz are stated in the
studio. Drum placements are specific to the demo legend, not a universal map.
