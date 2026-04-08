Optional in-app music
---------------------
If a user turns on "Play music in app" on the Character page, the client loads the URL from
config (default: /audio/pokemon.mp3).

Place your MP3 here, for example:

  pokemon.mp3

Use only audio you have rights to use. Override the URL in .env:

  AMBIENT_MUSIC_PATH=/audio/pokemon.mp3
  AMBIENT_MUSIC_VOLUME=0.22

Set AMBIENT_MUSIC_PATH to empty to disable loading any file (toggle is still saved).

After turning music on, tap or press a key once on the page so the browser is allowed to play audio.

If you use a full https:// URL for the track, you must allow that host in Content-Security-Policy
mediaSrc in server.js (default is same-origin only).
