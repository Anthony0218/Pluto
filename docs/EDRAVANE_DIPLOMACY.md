# Insults, border conquest, and map navigation

## Insults

Use **Insult House …** in a house profile or the council. Each house can be
insulted once per round. Relations fall by 20 on both sides. Insulting your own
sworn vassal also costs 15 opinion and reduces their loyalty.

The recipient's crown can choose **Answer a diplomatic insult** when declaring
war on the sender's realm. Insulting a foreign vassal gives their liege the same
reason. Sending an insult does not give the sender a justification.
The justification avoids declaration unrest and loyalty penalties, is consumed
when used, and unresolved grievances between the two realms are cleared by
accepted peace. Insults are saved with the campaign, and older saves without
insult history remain supported.

Bots can answer an insult by declaring justified war on their own turn.
The receiving player retains the normal defensive response and peace controls.
Multiplayer commands validate the acting player, current turn, target house,
duplicate insults, and the actual reason evidence.

## Territorial conquest

**Territorial conquest of an unprotected border** is available when a foreign
land hex directly borders land controlled by your house or its sworn vassals.
Current occupation determines control. Sea and legacy cells do not create a
land border. When declaring war through an attack, the selected target hex
itself must meet these rules; a distant border elsewhere cannot justify it.

Accepted marriages between living members of the two realms protect the border,
including vassal marriages. A pending marriage offer or positive relationship
alone is not a pact. Protected or distant targets can still have another
evidenced war reason; otherwise the existing unjustified-war penalties apply.
Bot conquest planning follows the same border and pact rules.

## Map navigation

The four arrow buttons beside the zoom controls move the view west, north,
south, or east without selecting a district or changing the zoom. Arrow keys
work when the map or direction controls have focus. Dragging works at every
zoom level, including 100% and 75%; previously it was disabled at 100% or lower.
Camera movement stops at the map bounds. **Fit map** resets the view.

## Verification

The full game suite passes 77 tests, including ten diplomacy tests and eight
live WebSocket tests. The added live test verifies turn authority, insult
delivery to a foreign vassal, rejection of fabricated insult claims, the
recipient crown's justified declaration, defender notification, and absence of
declaration penalties. Browser checks cover directional movement, unchanged
selection, dragging at 100%, keyboard movement, bounds, conquest reasons,
accepted-pact protection, insult limits, and bot retaliation.
