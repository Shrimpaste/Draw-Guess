# InkMuse UI Direction

This file captures the visual direction for the Draw-and-Guess client in a format inspired by the `awesome-design-md` approach: define the system first, then let implementation follow it consistently.

## Product

- Multiplayer drawing and guessing game
- Primary surfaces: login, lobby, room stage, live canvas, side control rail
- Primary constraint: the UI can be expressive, but game actions and API wiring must stay obvious and reliable

## Visual Intent

- Editorial stage design instead of generic SaaS dashboard
- Bold composition with visible rails, gridlines, and asymmetry
- Warm paper base with vivid signal colors so the interface feels human and physical
- Canvas is the hero; everything else behaves like production notes around a live performance

## Design Rules

- Avoid default “AI app” gradients and anonymous rounded cards
- Use one serif display face for headlines and one geometric sans for interface text
- Keep strong contrast for buttons, tokens, and live-state badges
- Use motion for arrival and emphasis, not constant floating or noisy micro-interactions
- Preserve all current room, round, session, and websocket flows

## Color System

- Base: `#f4efe7`
- Paper: `#fffaf4`
- Ink: `#17110f`
- Accent: `#ff5b36`
- Blue signal: `#2f6bff`
- Green success/live: `#2db489`
- Gold waiting/wrap-up: `#d9a126`

## Layout Principles

- Lobby: split between compose rail and live room wall
- Room: left side is the stage, right side is the control/program rail
- Mobile: collapse to a single column without changing action order

## Interaction Rules

- API calls stay on the existing `/api/*` endpoints
- Realtime canvas and room updates stay on `/ws`
- Buttons should always look clickable without relying on hover
- Inputs need clear focus states and enough contrast in light mode
