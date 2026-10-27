// Survey-wide settings. Edit freely.
window.SURVEY_CONFIG = {
  // Where responses are POSTed (JSON, sent as text/plain so no CORS preflight).
  //   null   -> auto: "/api/responses" on localhost (served by server.js), nothing on GitHub Pages
  //   ""     -> never send; keep answers in this browser only
  //   "https://script.google.com/macros/s/XXXX/exec" -> Google Apps Script / Supabase / any endpoint
  ENDPOINT: null,

  // Bump this if you change the questions, so old saved sessions are not resumed.
  VERSION: 1,

  // Show the benchmark percentages in the insight boxes ("29% of readers said the same").
  // The numbers in questions.js are PLACEHOLDERS until you have real data.
  SHOW_BENCHMARKS: true,
};
