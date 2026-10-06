# Idea Space

Build a single-user personal idea board web app called "Idea Board".

PRIORITIES

Function over appearance. Do not spend effort on visual polish, animations,

custom styling, illustrations, landing pages or branding. Use plain, default,

unstyled-looking components throughout. Every instruction below is about

behaviour, and behaviour is what matters. If a choice is not specified here,

pick the simplest option that works and move on.

NO AUTHENTICATION

No sign-up, no login, no accounts, no user management, no landing page. Opening

the app goes straight to the board. Store all data in the browser's localStorage

and load it on page open.

PURPOSE

Dump an idea in under five seconds, come back later to read and sort. Never put

a required field between the user and posting an idea.

CAPTURE

- A capture bar is always visible: one text input with placeholder "What's the

  idea?" and a Post button.

- Enter posts. Shift+Enter makes a new line.

- Two optional controls beside the input: a section dropdown and a date picker.

  Both can be left untouched.

- Posting with no section files the note under a built-in section "Unsorted".

- After posting: input clears, refocuses, note appears immediately. No modal,

  no confirmation, no reload.

NOTES

- Notes display as squares on a board area with a light blue background.

- Notes are draggable; their x/y position is saved to localStorage and restored

  on reload.

- Clicking a note edits it inline — text, section and due date. Saves on blur.

- Each note has: Done, Archive, Delete. Done and Archive move it off the board

  into an Archive view. Delete asks for confirmation, then removes permanently.

SECTIONS

- The user creates, renames, recolours and deletes sections.

- Each section has a name and a colour picked from eight preset pastel colours.

- A note's background colour is its section's colour. "Unsorted" notes are white.

- Deleting a section moves its notes to "Unsorted" — it never deletes notes.

- Section chips across the top act as filters. Clicking one filters the board,

  clicking again clears it. An "All" chip is selected by default.

DUE DATES

- Optional. A note with a due date shows a small filled circle in its corner

  with the date in small text beside it.

- Circle colour depends only on time remaining:

    more than 7 days   -> green

    3 to 7 days        -> yellow

    under 3 days       -> orange

    today or overdue   -> red

- No due date means no circle.

- The due date never changes the note's background colour. Section colour and

  due-date colour are two separate signals and must not interfere.

BOARD CONTROLS

- "Tidy up" button: reflows all visible notes into a clean grid, grouped by

  section.

- Search box: filters notes by text as the user types.

- Sort toggle: Newest / Oldest / By due date.

- Archive view: lists done and archived notes, each restorable to the board.

- A counter showing the number of active notes.

DATA MODEL (localStorage)

notes: id, text, sectionId, dueDate, x, y, status (active/done/archived),

createdAt, updatedAt

sections: id, name, colour, createdAt

EMPTY STATE

A plain line of text: "Your board is empty. What's on your mind?" with the

capture input focused.

DO NOT BUILD

No accounts, no collaboration, no sharing, no comments, no attachments, no

notifications, no AI features, no onboarding, no marketing page, no dark mode,

no settings screen.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/720b9439-06e3-47ef-8af1-fda2015ca566).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
