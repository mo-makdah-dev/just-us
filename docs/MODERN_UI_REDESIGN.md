# Just Us — complete UI / UX redesign

Date: October 18, 2026
Scope: guest landing, signed-in dashboard, navigation, People, profile/avatar studio, security, scores, room lounge, conversation, invitation controls, game library and game surfaces. Existing data, routes, memberships, invitation semantics and authoritative game rules remain the foundation.

## Confirmed direction

The user explicitly corrected the initial dark direction: this is a couples website. Preserve the light palette, purple accents and cozy illustrated atmosphere that his partner liked. Modernization applies to usability, hierarchy, navigation, spacing and interactions. Charcoal/gaming-app styling is superseded.

## Research and sample board

Primary visual direction: Paired (https://www.paired.com/articles/paired-new-look), its warm purple couples-first identity and original illustrations, plus Headspace (https://developer.apple.com/news/?id=fkfnhq8u) for friendly approachable interaction. Paired/headspace sample screenshots are saved alongside the earlier secondary references.

Public references were reviewed and captured locally in `docs/design-references/`:

- Linear — https://linear.app/ — compact product navigation, restrained contrast, consistent type scale, and secondary actions kept quiet. Screenshot: linear.png. The first screenshot captured its navigation while animated content was still loading; it is not a complete product screenshot.
- Discord — https://discord.com/ and https://discord.com/blog/server-activities-games-voice-watch-together — social gaming as the main activity, strong hierarchy and people/presence beside the experience. Screenshot: discord.png.
- Gather — https://www.gather.town/virtual-office and https://support.gather.town/articles/3602925011-participants-panel-overview — the room as a place, with identifiable people and clear presence. Screenshot: gather.png.
- Material canonical layouts — https://m3.material.io/foundations/layout/canonical-examples/overview — adapt the content/navigation arrangement by available width rather than shrinking a desktop layout.

These are references, not templates to copy or assets to reuse. Existing avatars and original code-native room scenes will be retained and integrated. No packages, fonts or browser runtimes need installation.

## 1. Visual system

- Warm cream canvas (#fbf8f5), white card surfaces (#fffdfb), soft lavender (#f2edf5), plum text (#43374c) and familiar purple actions (#74548d).
- Mint for actual online presence and success, amber for pending states, coral for destructive actions/errors. Status is also expressed with words/icons rather than colour alone.
- System sans-serif for body text and controls; cozy serif for selected display headings; no decorative italic serif headings. Large but concise page titles and a readable 14–16px body scale.
- Spacing uses 4/8px increments. Cards use 16px corners, inputs 10px, pills only for status. One focus treatment across links, buttons and fields.
- Original cosy illustrations stay as intentional light visual islands inside light, cozy cards. Pixel avatars remain distinctive and legible.
- Disabled controls use subdued surfaces and a neutral cursor. No wait cursor or spinner unless an operation is actually running. Busy actions have explicit text and aria-busy.

## 2. Navigation and information architecture

- Retain real URLs and Back/Forward support: /dashboard, /account?section=people|scores|security and /room/<id>.
- Laptop/tablet: compact sticky top navigation with icons, labels, clear current-page state and a clickable profile.
- Mobile: brand/profile stay at the top; the four primary destinations become a labelled bottom navigation bar with safe-area padding. Do not hide navigation behind an ambiguous icon.
- No redundant page-level back controls. No fake search, fake notifications or decorative controls that do nothing.
- Add a keyboard skip link and keep dialog focus/escape/backdrop behavior.

## 3. Guest landing and dashboard

- Rework landing hierarchy with one clear message and create/join actions, an original room visual, brief benefits and truthful free-account access.
- Dashboard uses a concise welcome, a featured lounge introduction, honest compact statistics, then visual rooms.
- Room cards remain the navigation target with real member avatars and presence. Management remains in the overflow menu.
- Empty/new-room states should look intentional and invite the next step, without a wall of explanatory copy.
- Preserve guest access, sign-in/sign-up, code entry and existing room links.

## 4. People, profile and settings

- Use meaningful page titles for People, Scores, Account settings and Profile, instead of repeating the same greeting on every screen.
- Special person has a distinct but restrained row. Friends appear individually; inline title editing remains in-place.
- Pet names and connection management remain available with readable labels and clear destructive confirmations.
- Profile uses one compact seven-choice avatar picker. Drawing mode contains the canvas/base presets and explicit Save/Cancel actions.
- Security uses a small settings surface with progressive password editing. Profile and account actions must remain easy to find.
- Scores show only played games and a designed empty state otherwise.

## 5. Room and games

- Reduce the giant decorative room heading; make the room name and connection state the useful context.
- Laptop: spacious room scene and game surface, with an adjacent conversation panel. Management stays in a quieter disclosure.
- Tablet: balance scene/chat columns where space permits; stack when necessary.
- Mobile: Room/Chat tabs, comfortable composer, no horizontal overflow, controls stay reachable above the app navigation.
- Invitation code fields retain refresh/copy icons and accessible names. Friend invitation remains a modal.
- Refresh game library cards, ready/coming-soon states, tic-tac-toe board, player selection and score tables consistently.
- No game-rule or database migration work is required for the redesign.

## 6. Responsive and interaction requirements

- Review 1440px laptop, 1024/820px tablet, and 390/360px mobile viewports.
- Support long names, multiple rooms, empty lists, errors, reconnecting, disabled controls and custom avatars.
- Touch controls are generally at least 44px. No action depends only on hover. Menus/dialogs work with keyboard and touch.
- Honor reduced-motion preferences. Avoid heavy parallax, autoplay media or external asset/font dependencies.
- Use new scoped design-system CSS as the presentation entry point; retain existing structural/art styles and clearly override legacy visuals, with coverage for every app surface.

## 7. Delivery batches and verification

- Batch A: research/sample board and this plan; then design tokens, app navigation, landing and dashboard.
- Batch B: People, profile, security, scores, room, chat, game library and interaction states.
- Batch C: build/type checks and focused browser regression for existing flows; add responsive screenshot and accessibility coverage. Inspect rendered laptop/tablet/phone samples, repair observed issues, then rerun affected checks.
- Confirm no false loading cursor on disabled actions, no blocked primary controls, no missing content and no horizontal overflow.
- Exercise room creation/name/URL, invitation dialog, profile drawing persistence, password editing, navigation history and active game layout in isolated test data.
- Deploy the verified build through the existing repository/Render workflow with its encrypted backup. Verify readiness and exact deployed asset hashes. Keep local preview available for review.

## Acceptance

The result should read as one coherent, contemporary social-games product on every requested device, rather than a collection of patches to individual buttons. Report actual test coverage and any unverified limitations, with links to the plan, samples and live result.

## Verified result

- Production build and type checking passed.
- Full unit/integration suite: 102 passed.
- Focused browser suite: 8 passed, covering navigation history, avatar save/cancel/reload, password change, room names/URLs, membership controls, multiple tabs and actual game setup.
- Screenshots rendered at 1440, 1024, 820, 390 and 360 CSS pixels; inspected desktop/tablet/mobile samples are in docs/redesign-preview/.
- Automated WCAG A/AA checks on landing, People, expanded password settings, profile, room and game library reported no violations after contrast corrections. This is targeted automated coverage, not a full accessibility certification.
- No horizontal overflow in the tested page/viewport combinations. Disabled controls use a neutral cursor. The cozy light-purple direction supersedes the early dark reference experiment.
