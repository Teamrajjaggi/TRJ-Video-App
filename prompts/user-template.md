# Generation request

Generate one short-form vertical video for the feed.

## What the reviewers want (auto-generated)

The following block is `CLAUDE.md`, regenerated after every like / dislike /
comment. Treat the **Generation guidance**, **Prefer**, **Avoid**, and
**Suspected dislike reasons** sections as binding constraints, in that
order of priority.

```
{{CONTEXT}}
```

## Recent dislike notes (verbatim, last 10)

Use these as concrete examples of what to **avoid** in the next clip.

```
{{RECENT_DISLIKE_NOTES}}
```

## Recent approval notes (verbatim, last 10)

Use these as concrete examples of what reviewers loved.

```
{{RECENT_LIKE_NOTES}}
```

## Output

Return the JSON object described in the system prompt — nothing else.
